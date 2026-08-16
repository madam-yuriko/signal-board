import "server-only";

import { unstable_cache } from "next/cache";
import { disasters } from "@/data/disasters";
import { hardware } from "@/data/hardware";
import { movies } from "@/data/movies";
import { redevelopments } from "@/data/redevelopments";
import type {
  MovieType,
  TopicBoard,
  TopicDomain,
  TopicStatusTone,
} from "@/types/topics";

const REVALIDATE_SECONDS = 60 * 60 * 6;
const FETCH_TIMEOUT_MS = 12_000;
const EIGA_ORIGIN = "https://eiga.com";
const MOVIE_UPCOMING_DAYS = 90;

interface FeedEntry {
  title: string;
  link?: string;
  description?: string;
  date?: string;
  image?: string;
  movieType?: MovieType;
  genres?: string[];
}

export interface TopicFeed {
  items: TopicBoard[];
  mode: "live" | "fallback";
  sourceName: string;
  updatedAt?: string;
}

const FALLBACKS: Record<TopicDomain, TopicBoard[]> = {
  hardware,
  redevelopment: redevelopments,
  movie: movies,
  disaster: disasters,
};

const FALLBACK_IMAGES: Record<TopicDomain, string> = {
  hardware: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80",
  redevelopment: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
  movie: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1200&q=80",
  disaster: "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1200&q=80",
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) =>
      named[name.toLowerCase()] ?? entity,
    );
}

function plainText(value: string): string {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}

const MOVIE_GENRE_RULES: Array<[string, RegExp]> = [
  ["アクション", /アクション|action/i],
  ["ホラー", /ホラー|horror/i],
  ["サスペンス", /サスペンス|thriller|suspense/i],
  ["パニック", /パニック|panic/i],
  ["SF", /\bSF\b|サイエンスフィクション|science fiction/i],
  ["ファンタジー", /ファンタジー|fantasy/i],
  ["ドラマ", /ドラマ|drama/i],
  ["コメディ", /コメディ|喜劇|comedy/i],
  ["恋愛", /恋愛|ラブストーリー|romance/i],
  ["青春", /青春|coming[- ]of[- ]age/i],
  ["アドベンチャー", /アドベンチャー|冒険|adventure/i],
  ["ミステリー", /ミステリー|mystery/i],
  ["ドキュメンタリー", /ドキュメンタリー|documentary/i],
  ["戦争", /戦争|war film/i],
  ["スポーツ", /スポーツ|sports/i],
  ["音楽", /ミュージカル|音楽|music|musical/i],
  ["歴史・伝記", /歴史|伝記|historical|biographical/i],
  ["ファミリー", /ファミリー|family/i],
];

function classifyMovie(title: string, description: string, html: string): Pick<FeedEntry, "movieType" | "genres"> {
  const detailText = plainText(html);
  const country = detailText.match(/製作[／/]\s*[^／/\n]{1,20}[／/]\s*([^\s／/、,]+)/i)?.[1] ?? "";
  const story = detailText.match(/解説・あらすじ([\s\S]*?)(?:スタッフ・キャスト|全てのスタッフ)/i)?.[1] ?? detailText.slice(0, 4_000);
  const searchable = `${title} ${description} ${country} ${story}`;
  const anime = /アニメーション|アニメ作品|劇場版アニメ|anime|animation|3d\s*cg|cg作品/i.test(searchable);
  const movieType: MovieType = anime
    ? "アニメ/CG"
    : country
      ? /日本|japan/i.test(country)
        ? "邦画"
        : "洋画"
      : /[A-Za-z]{3,}/.test(title)
        ? "洋画"
        : "邦画";
  const genres = MOVIE_GENRE_RULES
    .filter(([, pattern]) => pattern.test(searchable))
    .map(([genre]) => genre);
  return {
    movieType,
    genres: genres.length > 0 ? genres : ["その他"],
  };
}

function parseFeed(xml: string): FeedEntry[] {
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)];
  return blocks.flatMap((match) => {
    const block = match[0];
    const title = plainText(firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? "");
    const description = plainText(
      firstMatch(block, /<(?:description|summary|content:encoded)[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded)>/i) ?? "",
    );
    const link = firstMatch(block, /<link[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i) ??
      firstMatch(block, /<link[^>]*>(https?:\/\/[^<]+)<\/link>/i);
    const date = firstMatch(block, /<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i);
    const image = firstMatch(block, /<(?:media:content|enclosure)[^>]*url=["']([^"']+)["']/i) ??
      firstMatch(block, /<img[^>]+src=["']([^"']+)["']/i);
    return title ? [{ title, description, link, date, image }] : [];
  });
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const japaneseDate = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (japaneseDate) {
    const [, year, month, day] = japaneseDate;
    return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00+09:00`);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateLabel(value?: string, prefix = "更新"): string {
  const date = parseDate(value);
  if (!date) return prefix;
  return `${prefix} ${new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date)}`;
}

function updatedAt(entries: FeedEntry[]): string | undefined {
  return entries
    .map((entry) => parseDate(entry.date)?.toISOString())
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];
}

function imageFor(domain: TopicDomain, index: number, image?: string): string {
  return image ?? FALLBACKS[domain][index % FALLBACKS[domain].length]?.image ?? FALLBACK_IMAGES[domain];
}

function toneFor(status: string): TopicStatusTone {
  if (/警報|津波|危険|重大|噴火/i.test(status)) return "danger";
  if (/注意|監視|更新/i.test(status)) return "warning";
  return "info";
}

async function fetchText(url: string, accept = "text/html,application/xhtml+xml,application/xml") {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: accept, "User-Agent": "SignalBoard/1.0 (+public data reader)" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.ok) return response.text();
    if (response.status !== 429 || attempt === 2) {
      throw new Error(`${url} returned ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
  throw new Error(`${url} request failed`);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(values[index]);
      }
    }),
  );
  return results;
}

async function safeFetchText(url: string): Promise<string> {
  try {
    return await fetchText(url);
  } catch (error) {
    console.warn(`Unable to load movie listing page ${url}`, error);
    return "";
  }
}

async function fetchHardware(): Promise<TopicFeed> {
  const sources = [
    ["AMD", "https://newsroom.amd.com/feed/"],
    ["NVIDIA", "https://blogs.nvidia.com/blog/feed/"],
  ] as const;
  const results = await Promise.allSettled(sources.map(([, url]) => fetchText(url, "application/rss+xml,application/xml")));
  const entries = results.flatMap((result, index) =>
    result.status === "fulfilled"
      ? parseFeed(result.value).map((entry) => ({ ...entry, title: `[${sources[index][0]}] ${entry.title}` }))
      : [],
  ).slice(0, 24);
  if (entries.length === 0) throw new Error("No hardware news entries");
  const items = entries.map((entry, index): TopicBoard => {
    const category = /gpu|graphics|geforce|radeon|gaming/i.test(entry.title) ? "GPU" :
      /apu|embedded|npu|ryzen ai/i.test(entry.title) ? "APU" : "CPU";
    const source = entry.title.match(/^\[([^\]]+)\]/)?.[1] ?? "公式ニュース";
    const title = entry.title.replace(/^\[[^\]]+\]\s*/, "");
    return {
      id: `live-hardware-${index}-${entry.link ?? title}`,
      domain: "hardware",
      title,
      category,
      status: "updated",
      statusLabel: "最新更新",
      statusTone: "info",
      dateLabel: dateLabel(entry.date),
      location: `${source}公式ニュース`,
      region: source,
      summary: entry.description || `${source}の公式ニュースを取得しました。`,
      image: imageFor("hardware", index, entry.image),
      metrics: [
        { label: "発表元", value: source },
        { label: "カテゴリ", value: category },
        { label: "更新日", value: dateLabel(entry.date, "").trim() || "最新" },
        { label: "情報源", value: "公式RSS" },
      ],
      updates: [{ at: dateLabel(entry.date, "").trim() || "最新", text: entry.description || title }],
      tags: [source, category, "公式ニュース"],
    };
  });
  return { items, mode: "live", sourceName: "AMD / NVIDIA 公式RSS", updatedAt: updatedAt(entries) };
}

async function fetchRedevelopment(): Promise<TopicFeed> {
  const html = await fetchText("https://www.toshiseibi.metro.tokyo.lg.jp/information/press");
  const entries: FeedEntry[] = [...html.matchAll(/<li class="widget-information-content_info-list-date-list-item">([\s\S]*?)<\/li>/gi)].flatMap((match) => {
    const block = match[1];
    const title = firstMatch(block, /<a[^>]+class="widget-information-content_info-list-link"[^>]*>([\s\S]*?)<\/a>/i);
    const link = firstMatch(block, /<a[^>]+class="widget-information-content_info-list-link"[^>]+href="([^"]+)"/i);
    const date = firstMatch(block, /<time[^>]*>([\s\S]*?)<\/time>/i);
    return title ? [{ title: plainText(title), link, date }] : [];
  }).filter((entry) => /再開発|整備|駅|都市|建設|住宅|道路|地下化|耐震|無電柱|まち/i.test(entry.title));
  if (entries.length === 0) throw new Error("No redevelopment press entries");
  const items = entries.slice(0, 24).map((entry, index): TopicBoard => ({
    id: `live-redevelopment-${index}-${entry.link ?? entry.title}`,
    domain: "redevelopment",
    title: entry.title,
    category: "都市整備局発表",
    status: "updated",
    statusLabel: "最新更新",
    statusTone: "info",
    dateLabel: dateLabel(entry.date),
    location: "東京都",
    region: "東京",
    summary: "東京都都市整備局の報道発表から、都市整備・再開発に関係する更新を取得しました。",
    image: imageFor("redevelopment", index),
    metrics: [
      { label: "発表元", value: "東京都都市整備局" },
      { label: "更新日", value: dateLabel(entry.date, "").trim() || "最新" },
      { label: "地域", value: "東京" },
      { label: "状態", value: "公式発表" },
    ],
    updates: [{ at: dateLabel(entry.date, "").trim() || "最新", text: entry.title }],
    tags: ["東京都", "都市整備局", "公式発表"],
  }));
  return { items, mode: "live", sourceName: "東京都都市整備局 報道発表", updatedAt: updatedAt(entries) };
}

function movieUrls(indexHtml: string): string[] {
  const listedUrls = [...indexHtml.matchAll(
    /class=["']list-block\s+list-block2["'][\s\S]{0,1800}?href=["'](?:https?:\/\/eiga\.com)?(\/movie\/\d+\/)/gi,
  )].map((match) => `${EIGA_ORIGIN}${match[1]}`);
  const urls = listedUrls.length > 0
    ? listedUrls
    : [...indexHtml.matchAll(/(?:https?:\/\/eiga\.com)?(\/movie\/\d+\/)/gi)]
      .map((match) => `${EIGA_ORIGIN}${match[1]}`);
  return [...new Set(urls)];
}

function nowMoviePageUrls(indexHtml: string): string[] {
  const pages = [...indexHtml.matchAll(/href=["'](\/now\/all\/release\/\d+\/)["']/gi)]
    .map((match) => `${EIGA_ORIGIN}${match[1]}`);
  return [...new Set([`${EIGA_ORIGIN}/now/`, ...pages])];
}

function comingMoviePageUrls(indexHtml: string): string[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + MOVIE_UPCOMING_DAYS);
  const minMonth = today.getFullYear() * 12 + today.getMonth();
  const maxMonth = cutoff.getFullYear() * 12 + cutoff.getMonth();
  const pages = [...indexHtml.matchAll(/href=["'](\/coming\/(\d{4})(\d{2})\/)["']/gi)]
    .filter((match) => {
      const month = Number(match[2]) * 12 + Number(match[3]) - 1;
      return Number(match[3]) <= 12 && month >= minMonth && month <= maxMonth;
    })
    .map((match) => `${EIGA_ORIGIN}${match[1]}`);
  return [...new Set([`${EIGA_ORIGIN}/coming/`, ...pages])];
}

async function fetchMovieDetails(url: string, status: "screening" | "upcoming"): Promise<FeedEntry | undefined> {
  try {
    const html = await fetchText(url);
    const title = firstMatch(html, /<h1 class="page-title">([\s\S]*?)<\/h1>/i);
    if (!title) return undefined;
    const cleanTitle = plainText(title);
    const description = plainText(firstMatch(html, /<meta name="description" content="([^"]+)"/i) ?? "");
    const classification = classifyMovie(cleanTitle, description, html);
    return {
      title: cleanTitle,
      link: url,
      description,
      date:
        firstMatch(html, /class=["']date-published["'][^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/i) ??
        firstMatch(html, /<p[^>]+class=["']data["'][^>]*>[\s\S]*?劇場公開日[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/i),
      image: firstMatch(html, /<div class="hero-img">[\s\S]*?<img[^>]+src="([^"]+)"/i),
      status,
      ...classification,
    } as FeedEntry & { status: "screening" | "upcoming" };
  } catch {
    return undefined;
  }
}

function getCachedMovieDetails(
  url: string,
  status: "screening" | "upcoming",
): Promise<FeedEntry | undefined> {
  return unstable_cache(
    () => fetchMovieDetails(url, status),
    ["signal-board-movie-detail-v1", status, url],
    {
      revalidate: REVALIDATE_SECONDS,
      tags: ["movie-feed-details"],
    },
  )();
}

async function fetchMovies(): Promise<TopicFeed> {
  const nowIndex = await fetchText(`${EIGA_ORIGIN}/now/`);
  const comingIndex = await safeFetchText(`${EIGA_ORIGIN}/coming/`);
  const nowPageUrls = nowMoviePageUrls(nowIndex);
  const nowPages = await mapWithConcurrency(
    nowPageUrls.slice(1),
    2,
    safeFetchText,
  );
  const comingPageUrls = comingIndex ? comingMoviePageUrls(comingIndex) : [];
  const comingPages = comingIndex
    ? await mapWithConcurrency(comingPageUrls.slice(1), 2, safeFetchText)
    : [];
  const urls = [
    ...[nowIndex, ...nowPages].flatMap(movieUrls).map((url) => ({ url, status: "screening" as const })),
    ...[comingIndex, ...comingPages].flatMap(movieUrls).map((url) => ({ url, status: "upcoming" as const })),
  ].filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index);
  const details = (await mapWithConcurrency(urls, 6, (item) => getCachedMovieDetails(item.url, item.status))).filter(
    (entry): entry is FeedEntry & { status: "screening" | "upcoming" } => Boolean(entry),
  ).filter((entry) => {
    if (entry.status === "screening") return true;
    const releaseDate = parseDate(entry.date);
    if (!releaseDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + MOVIE_UPCOMING_DAYS);
    return releaseDate >= today && releaseDate <= cutoff;
  });
  if (details.length === 0) throw new Error("No movie entries");
  const items = details.map((entry, index): TopicBoard => ({
    id: `live-movie-${entry.link ?? index}`,
    domain: "movie",
    sourceUrl: entry.link,
    title: entry.title,
    category: entry.genres?.[0] ?? "その他",
    status: entry.status,
    statusLabel: entry.status === "screening" ? "劇場公開中" : "公開予定",
    statusTone: entry.status === "screening" ? "info" : "warning",
    dateLabel: dateLabel(entry.date, entry.status === "screening" ? "公開" : "公開予定"),
    location: "全国劇場",
    region: "全国",
    summary: entry.description || "映画.comの作品情報から取得しました。",
    image: imageFor("movie", index, entry.image),
    metrics: [
      { label: "公開日", value: dateLabel(entry.date, "").trim() || "未定" },
      { label: "状態", value: entry.status === "screening" ? "上映中" : "公開予定" },
      { label: "地域", value: "全国" },
      { label: "情報源", value: "映画.com" },
    ],
    updates: [{ at: dateLabel(entry.date, "").trim() || "最新", text: "映画.comの作品情報を更新" }],
    tags: [
      "映画.com",
      entry.status === "screening" ? "上映中" : "公開予定",
      ...(entry.genres ?? []),
    ],
    movieType: entry.movieType,
    genres: entry.genres,
  }));
  return { items, mode: "live", sourceName: "映画.com 上映中・公開予定", updatedAt: new Date().toISOString() };
}

async function fetchDisasters(): Promise<TopicFeed> {
  const xml = await fetchText("https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml", "application/atom+xml,application/xml");
  const entries: FeedEntry[] = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].flatMap((match) => {
    const block = match[1];
    const title = plainText(firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? "");
    const date = firstMatch(block, /<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const link = firstMatch(block, /<link[^>]+href=["']([^"']+)["']/i);
    return title ? [{ title, date, link }] : [];
  });
  if (entries.length === 0) throw new Error("No JMA disaster entries");
  const items = entries.slice(0, 20).map((entry, index): TopicBoard => {
    const category = /火山|噴火/i.test(entry.title) ? "火山" : /津波/i.test(entry.title) ? "津波" : "地震";
    const statusLabel = /警報|津波|噴火/i.test(entry.title) ? "警戒" : "情報更新";
    return {
      id: `live-disaster-${index}-${entry.link ?? entry.title}`,
      domain: "disaster",
      title: entry.title,
      category,
      status: "monitoring",
      statusLabel,
      statusTone: toneFor(entry.title),
      dateLabel: dateLabel(entry.date),
      location: "気象庁防災情報",
      region: "全国",
      summary: "気象庁の地震・火山防災情報XMLフィードから取得した最新電文です。",
      image: imageFor("disaster", index),
      metrics: [
        { label: "情報種別", value: category },
        { label: "発表", value: dateLabel(entry.date, "").trim() || "最新" },
        { label: "対象", value: "全国" },
        { label: "情報源", value: "気象庁XML" },
      ],
      updates: [{ at: dateLabel(entry.date, "").trim() || "最新", text: entry.title }],
      tags: ["気象庁", category, "防災情報XML"],
    };
  });
  return { items, mode: "live", sourceName: "気象庁 地震火山情報XML", updatedAt: updatedAt(entries) };
}

async function buildTopicFeed(domain: TopicDomain): Promise<TopicFeed> {
  if (domain === "hardware") return fetchHardware();
  if (domain === "redevelopment") return fetchRedevelopment();
  if (domain === "movie") return fetchMovies();
  return fetchDisasters();
}

const getCachedTopicFeed = unstable_cache(
  async (domain: TopicDomain) => buildTopicFeed(domain),
  ["signal-board-topic-feed-v8-differential-movie-details"],
  { revalidate: REVALIDATE_SECONDS, tags: ["topic-feed"] },
);

export async function getTopicFeed(domain: TopicDomain): Promise<TopicFeed> {
  try {
    return await getCachedTopicFeed(domain);
  } catch (error) {
    console.warn(`Unable to load live ${domain} feed`, error);
    return {
      items: FALLBACKS[domain],
      mode: "fallback",
      sourceName: "保存データ",
    };
  }
}
