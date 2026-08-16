import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

const EIGA_ORIGIN = "https://eiga.com";

interface TheaterCandidate {
  name: string;
  path: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&(?:amp|＆);/gi, "&")
    .replace(/&(?:nbsp);/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/トーホー/g, "toho")
    .replace(/[\s・·,.、。\-ー]/g, "");
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "SignalBoard/1.0 (+public movie theater availability reader)",
    },
    next: { revalidate: 60 * 60 * 6 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`映画.com returned ${response.status}`);
  return response.text();
}

function theaterCandidates(html: string): TheaterCandidate[] {
  const candidates: TheaterCandidate[] = [];
  const pattern = /<a[^>]+href=["'](\/theater\/\d+\/\d+\/\d+\/)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const name = decodeHtml(match[2]);
    if (!name) continue;
    candidates.push({ name, path: match[1] });
  }
  const unique = new Map<string, TheaterCandidate>();
  for (const candidate of candidates) {
    const previous = unique.get(candidate.path);
    if (!previous || candidate.name.length < previous.name.length ||
      (/^https?:\/\//i.test(previous.name) && !/^https?:\/\//i.test(candidate.name))) {
      unique.set(candidate.path, candidate);
    }
  }
  return [...unique.values()];
}

function movieTheaterCandidates(html: string): TheaterCandidate[] {
  const candidates: TheaterCandidate[] = [];
  const pattern = /<a[^>]+href=["']\/movie-theater\/\d+\/(\d+)\/(\d+)\/(\d+)\/["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const name = decodeHtml(match[4]);
    if (!name) continue;
    candidates.push({ name, path: `/theater/${match[1]}/${match[2]}/${match[3]}/` });
  }
  return [...new Map(candidates.map((candidate) => [candidate.path, candidate])).values()];
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index]);
    }
  }));
  return results;
}

async function fetchTheaterOptions(prefecture: string): Promise<TheaterCandidate[]> {
  const indexHtml = await fetchHtml(`${EIGA_ORIGIN}/theater/${prefecture}/`);
  const cityPaths = [...indexHtml.matchAll(
    new RegExp(`href=["'](\\/theater\\/${prefecture}\\/\\d{6}\\/)["']`, "gi"),
  )].map((match) => match[1]);
  const cityUrls = [...new Set(cityPaths)].map((path) => `${EIGA_ORIGIN}${path}`);
  const pages = await mapWithConcurrency(cityUrls, 4, async (url) => {
    try {
      return await fetchHtml(url);
    } catch {
      return "";
    }
  });
  const options = [indexHtml, ...pages].flatMap(theaterCandidates);
  const unique = new Map<string, TheaterCandidate>();
  for (const option of options) unique.set(option.path, option);
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

const getCachedTheaterOptions = unstable_cache(
  (prefecture: string) => fetchTheaterOptions(prefecture),
  ["signal-board-movie-theater-options-v2"],
  { revalidate: 60 * 60 * 6, tags: ["movie-theater-options"] },
);

async function resolveTheater(name: string): Promise<TheaterCandidate | undefined> {
  const query = name.trim();
  if (!query) return undefined;
  const target = normalize(query);
  const searchQueries = [...new Set([query, query.replace(/トーホー/g, "TOHO")])];
  for (const searchQuery of searchQueries) {
    const html = await fetchHtml(`${EIGA_ORIGIN}/search/?c=theater&t=${encodeURIComponent(searchQuery)}`);
    const candidates = theaterCandidates(html);
    if (candidates.length === 0) continue;
    return candidates.find((candidate) => normalize(candidate.name) === target) ?? candidates[0];
  }
  return undefined;
}

async function checkAvailability(
  movieId: string,
  theater: TheaterCandidate,
): Promise<boolean> {
  const [, , prefecture, area, theaterId] = theater.path.split("/");
  if (!prefecture || !area || !theaterId) return false;
  try {
    const html = await fetchHtml(
      `${EIGA_ORIGIN}/movie-area/${movieId}/${prefecture}/${area}/`,
    );
    const theaterLink = new RegExp(
      `\\/theater\\/${prefecture}\\/${area}\\/${theaterId}\\/`,
    );
    return theaterLink.test(html) && /\b\d{1,2}:\d{2}\b/.test(decodeHtml(html));
  } catch {
    return false;
  }
}

async function findTokyoSuggestions(movieId: string): Promise<TheaterCandidate[]> {
  try {
    const html = await fetchHtml(`${EIGA_ORIGIN}/movie-pref/${movieId}/13/`);
    return movieTheaterCandidates(html).slice(0, 3);
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("options") === "1") {
    const prefecture = url.searchParams.get("pref") ?? "13";
    if (!/^\d{1,2}$/.test(prefecture)) {
      return NextResponse.json({ theaters: [] }, { status: 400 });
    }
    try {
      const theaters = await getCachedTheaterOptions(prefecture);
      return NextResponse.json({ theaters });
    } catch (error) {
      console.warn(`Unable to load movie theater options for prefecture ${prefecture}`, error);
      return NextResponse.json({ theaters: [] }, { status: 502 });
    }
  }
  const movieUrl = url.searchParams.get("movie") ?? "";
  const movieId = movieUrl.match(/https?:\/\/eiga\.com\/movie\/(\d+)\/?/i)?.[1];
  const names = [...new Set(url.searchParams.getAll("theater").map((name) => name.trim()).filter(Boolean))];
  if (!movieId || names.length === 0) {
    return NextResponse.json({ theaters: [] }, { status: 400 });
  }

  const resolved = (await Promise.all(names.map(async (name) => {
    try {
      const theater = await resolveTheater(name);
      if (!theater) return { name, available: false };
      return { name: theater.name, available: await checkAvailability(movieId, theater) };
    } catch {
      return { name, available: false };
    }
  }))).filter((theater) => theater.available);

  const suggestions = resolved.length === 0
    ? (await findTokyoSuggestions(movieId)).map((theater) => ({ name: theater.name, available: true }))
    : [];
  return NextResponse.json({ theaters: resolved, suggestions });
}
