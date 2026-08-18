import "server-only";

import type { Bout, BoxingEvent } from "@/types";
import { infoFromAffiliation } from "@/lib/fighterInfo";
import { organizationsFromText } from "@/lib/organizations";

const SCHEDULE_URL = "https://boxmob.jp/sp/schedule.html";
const DETAIL_URL = "https://boxmob.jp/sp/schedule/index.html";
const REVALIDATE_SECONDS = 60 * 60 * 6;
const FETCH_CONCURRENCY = 6;

interface ScheduleEntry {
  sid: string;
  year?: number;
  month: number;
  day: number;
  name: string;
  venue: string;
  startTime?: string;
}

export interface BoxmobCardSet {
  sid: string;
  date: string;
  name: string;
  detailsUrl: string;
  bouts: Bout[];
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) =>
      NAMED_ENTITIES[name.toLowerCase()] ?? entity,
    );
}

function plainText(value: string): string {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

async function fetchShiftJis(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "SignalBoard/1.0 (+public boxing schedule reader)",
    },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`Boxing Mobile returned ${response.status}`);
  }
  return new TextDecoder("shift_jis").decode(await response.arrayBuffer());
}

function parseScheduleList(html: string): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const pattern = /<div class="schedule_left">\s*(\d{1,2})\/(\d{1,2})[\s\S]*?<\/div>\s*<div class="schedule_center"><a href="schedule\/index\.html\?sid=(\d+)(?:&|&amp;)s=1"[^>]*>[\s\S]*?<\/a><\/div>\s*<div class="schedule_center_2nd"><a href="schedule\/index\.html\?sid=\3(?:&|&amp;)s=1"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/div>/gi;

  for (const match of html.matchAll(pattern)) {
    const [, month, day, sid, detailHtml, trailingHtml] = match;
    const [nameHtml = ""] = detailHtml.split(/<br\s*\/?>/i);
    const venueMatch = detailHtml.match(
      /会場[：:]\s*([\s\S]*?)(?:<br\s*\/?>|<\/span>)/i,
    );
    const timeMatch = trailingHtml.match(/(\d{1,2}:\d{2})\s*開始/);
    const name = plainText(nameHtml);
    const venue = venueMatch ? plainText(venueMatch[1]) : "会場未定";
    if (!name) continue;

    entries.push({
      sid,
      month: Number(month),
      day: Number(day),
      name,
      venue,
      startTime: timeMatch?.[1],
    });
  }

  return [...new Map(entries.map((entry) => [entry.sid, entry])).values()];
}

function parseFlashList(html: string, year: number, month: number): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const pattern = /<div class="flash">\s*<div class="flash_left">\s*(\d{1,2})\/(\d{1,2})\s*<\/div>\s*<div class="flash_center"><a href="flash\/index\.html\?sid=(\d+)(?:&|&amp;)f=1"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const [, monthText, dayText, sid, nameHtml] = match;
    const parsedMonth = Number(monthText);
    if (parsedMonth !== month) continue;
    const name = plainText(nameHtml);
    if (!name) continue;
    entries.push({
      sid,
      month: parsedMonth,
      day: Number(dayText),
      name,
      venue: "",
    });
  }
  return [...new Map(entries.map((entry) => [entry.sid, entry])).values()];
}

function normalizeWeightClass(headline: string): string {
  const text = plainText(headline)
    .replace(/ライトミニマム/g, "ミニマム")
    .replace(/スーパー/g, "S")
    .replace(/ライトフライ/g, "Lフライ")
    .replace(/ライトヘビー/g, "Lヘビー");
  const weight = text.match(
    /(?:ミニマム|Lフライ|フライ|Sフライ|バンタム|Sバンタム|フェザー|Sフェザー|ライト|Sライト|ウェルター|Sウェルター|ミドル|Sミドル|Lヘビー|クルーザー|ヘビー)級|\d+(?:\.\d+)?\s*(?:kg|ポンド)契約/i,
  )?.[0];
  if (!weight) return "契約階級";
  return weight
    .replace(/^S(?=[^\d])/i, "スーパー")
    .replace(/^Lフライ/i, "ライトフライ")
    .replace(/^Lヘビー/i, "ライトヘビー")
    .replace(/\s+/g, "");
}

interface BoxerProfile {
  name: string;
  affiliation?: string;
}

function boxerProfiles(section: string): BoxerProfile[] {
  const matches = [...section.matchAll(
    /bmsm_boookies__item-big__boxer-profile-name[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi,
  )];
  if (matches.length >= 2) {
    return matches.slice(0, 2).map((match, index) => {
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? section.length;
      const profileText = plainText(section.slice(start, end)).normalize("NFKC");
      const affiliation = profileText.match(/\(\s*\d+\s*=\s*([^()]+?)\s*\)/)?.[1];
      return {
        name: plainText(match[1]),
        affiliation: affiliation?.trim(),
      };
    });
  }

  return [...section.matchAll(/<img class="boxer"[^>]*alt="([^"]+)"/gi)]
    .map((match) => ({ name: plainText(match[1]) }))
    .filter(Boolean)
    .slice(0, 2);
}

function parseBouts(html: string, eventId: string): Bout[] {
  const sections = html.split(/<div class="bmsm_match_headline">/i).slice(1);
  return sections.flatMap((section, index) => {
    const headlineMatch = section.match(
      /<div class="match_headline">([\s\S]*?)<\/div>/i,
    );
    if (!headlineMatch) return [];
    const profiles = boxerProfiles(section);
    if (profiles.length < 2) return [];

    const headline = plainText(headlineMatch[1]);
    const jpInfo = infoFromAffiliation(profiles[0].affiliation);
    const opponentInfo = infoFromAffiliation(profiles[1].affiliation);
    return [{
      id: `${eventId}-b${index + 1}`,
      jpFighter: profiles[0].name,
      jpFighterGym: jpInfo.gym,
      jpFighterCountry: jpInfo.country,
      opponent: profiles[1].name,
      opponentCountry: opponentInfo.country,
      opponentGym: opponentInfo.gym,
      weightClass: normalizeWeightClass(headline),
      organizations: organizationsFromText(headline),
      result: "scheduled" as const,
      isMainEvent: index === 0,
      notes: headline,
    }];
  });
}

function eventYear(month: number, day: number, now: Date): number {
  const currentYear = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
    }).format(now),
  );
  const candidate = `${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const cutoff = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sevenDaysAgo);
  return candidate < cutoff ? currentYear + 1 : currentYear;
}

function cityForVenue(venue: string): string {
  const places: Array<[RegExp, string]> = [
    [/後楽園ホール|東京ドーム|両国国技館|有明|八王子|新宿/, "東京"],
    [/横浜|BUNTAI/i, "横浜"],
    [/大阪|住吉|堺|エルシアター|176BOX/i, "大阪"],
    [/神戸|兵庫/, "兵庫"],
    [/名古屋|愛知|刈谷|一宮|いちのみや|津島/, "愛知"],
    [/福岡|北九州|九州共立/, "福岡"],
    [/熊本/, "熊本"],
    [/千葉|八千代/, "千葉"],
    [/埼玉/, "埼玉"],
    [/茨城|つくば/, "茨城"],
    [/石川/, "石川"],
    [/静岡|ふじさん/, "静岡"],
    [/沖縄/, "沖縄"],
  ];
  return places.find(([pattern]) => pattern.test(venue))?.[1] ??
    venue.split(/[・（(]/)[0] ?? "日本";
}

function isDomesticVenue(venue: string): boolean {
  return !/(?:韓国|タイ|中国|フィリピン|米国|アメリカ|英国|イギリス|豪州|オーストラリア|メキシコ|サウジ|カザフ|ロシア|UAE|ドバイ|海外)/i.test(
    venue,
  );
}

function seriesForName(name: string): string {
  const normalized = name.normalize("NFKC");
  if (/PHOENIX\s*BATTLE|フェニックス[\s・･]*バトル/i.test(normalized)) {
    return "Phoenix Battle";
  }
  if (/Lemino/i.test(normalized)) return "Lemino Boxing";
  if (/Prime\s*Video/i.test(normalized)) return "Prime Video Boxing";
  if (/DYNAMIC\s*GLOVE|ダイナミック[\s・･]*グローブ/i.test(normalized)) {
    return "Dynamic Glove";
  }
  if (/U-?NEXT/i.test(normalized)) return "U-NEXT Boxing";
  if (/TREASURE/i.test(normalized)) return "Treasure-Boxing";
  if (/3150|KWORLD3/i.test(normalized)) return "3150 FIGHT";
  if (/Lifetime/i.test(normalized)) return "Lifetime Boxing Fights";
  return normalized.replace(/\[[^\]]+\]/g, "").trim();
}

async function loadEvent(
  entry: ScheduleEntry,
  now: Date,
  status: BoxingEvent["status"] = "scheduled",
): Promise<BoxingEvent> {
  const detailsUrl = `${DETAIL_URL}?sid=${entry.sid}&s=1`;
  let bouts: Bout[] = [];
  try {
    bouts = parseBouts(await fetchShiftJis(detailsUrl), `boxmob-${entry.sid}`);
  } catch (error) {
    console.warn(`Unable to load Boxing Mobile card ${entry.sid}`, error);
  }
  const year = eventYear(entry.month, entry.day, now);
  const domestic = isDomesticVenue(entry.venue);

  return {
    id: `boxmob-${entry.sid}`,
    date: `${year}-${String(entry.month).padStart(2, "0")}-${String(entry.day).padStart(2, "0")}`,
    status,
    name: entry.name,
    series: seriesForName(entry.name),
    venue: entry.venue,
    city: cityForVenue(entry.venue),
    domestic,
    startTime: entry.startTime,
    sourceName: "ボクシングモバイル",
    sourceUrl: SCHEDULE_URL,
    detailsUrl,
    sourceUpdatedAt: now.toISOString(),
    bouts,
  };
}

async function loadCardSet(entry: ScheduleEntry, year: number): Promise<BoxmobCardSet> {
  const detailsUrl = `${DETAIL_URL}?sid=${entry.sid}&s=1`;
  let bouts: Bout[] = [];
  try {
    bouts = parseBouts(await fetchShiftJis(detailsUrl), `boxmob-${entry.sid}`);
  } catch (error) {
    console.warn(`Unable to load Boxing Mobile historical card ${entry.sid}`, error);
  }
  return {
    sid: entry.sid,
    date: `${year}-${String(entry.month).padStart(2, "0")}-${String(entry.day).padStart(2, "0")}`,
    name: entry.name,
    detailsUrl,
    bouts,
  };
}

export async function fetchBoxmobHistoryCards(
  targetDates: string[],
): Promise<BoxmobCardSet[]> {
  const months = [...new Set(targetDates.map((date) => date.slice(0, 7)))];
  if (months.length === 0) return [];
  const indexEntries: ScheduleEntry[] = [];
  await Promise.all(
    months.map(async (monthKey) => {
      const [yearText, monthText] = monthKey.split("-");
      const year = Number(yearText);
      const month = Number(monthText);
      try {
        const html = await fetchShiftJis(
          `https://boxmob.jp/sp/flash.html/flash/flash/regist.html?m=${month}&y=${year}`,
        );
        indexEntries.push(
          ...parseFlashList(html, year, month).map((entry) => ({ ...entry, year })),
        );
      } catch (error) {
        console.warn(`Unable to load Boxing Mobile results index ${monthKey}`, error);
      }
    }),
  );
  const allowedDates = new Set(targetDates);
  const candidates = indexEntries.filter((entry) =>
    allowedDates.has(
      `${entry.year}-${String(entry.month).padStart(2, "0")}-${String(entry.day).padStart(2, "0")}`,
    ),
  );
  const results: BoxmobCardSet[] = new Array(candidates.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, candidates.length) }, async () => {
      while (cursor < candidates.length) {
        const index = cursor;
        cursor += 1;
        const entry = candidates[index];
        results[index] = await loadCardSet(entry, entry.year!);
      }
    }),
  );
  return results.filter((result) => result.bouts.length > 0);
}

export async function fetchBoxmobSchedule(): Promise<BoxingEvent[]> {
  const now = new Date();
  const entries = parseScheduleList(await fetchShiftJis(SCHEDULE_URL));
  if (entries.length === 0) {
    throw new Error("Boxing Mobile returned no scheduled events");
  }

  const events: BoxingEvent[] = new Array(entries.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, entries.length) }, async () => {
      while (cursor < entries.length) {
        const index = cursor;
        cursor += 1;
        events[index] = await loadEvent(entries[index], now);
      }
    }),
  );
  return events;
}
