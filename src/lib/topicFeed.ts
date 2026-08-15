import "server-only";

import { unstable_cache } from "next/cache";
import { disasters } from "@/data/disasters";
import { hardware } from "@/data/hardware";
import { movies } from "@/data/movies";
import { redevelopments } from "@/data/redevelopments";
import type { TopicBoard, TopicDomain, TopicStatusTone } from "@/types/topics";

const REVALIDATE_SECONDS = 60 * 60 * 6;
const FETCH_TIMEOUT_MS = 12_000;

interface FeedEntry {
  title: string;
  link?: string;
  description?: string;
  date?: string;
  image?: string;
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
  const response = await fetch(url, {
    headers: { Accept: accept, "User-Agent": "SignalBoard/1.0 (+public data reader)" },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
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
  return [...new Set([...indexHtml.matchAll(/https:\/\/eiga\.com\/movie\/\d+\//g)].map((match) => match[0]))];
}

async function fetchMovieDetails(url: string, status: "screening" | "upcoming"): Promise<FeedEntry | undefined> {
  try {
    const html = await fetchText(url);
    const title = firstMatch(html, /<h1 class="page-title">([\s\S]*?)<\/h1>/i);
    if (!title) return undefined;
    return {
      title: plainText(title),
      link: url,
      description: plainText(firstMatch(html, /<meta name="description" content="([^"]+)"/i) ?? ""),
      date: firstMatch(html, /<p class="date-published">[\s\S]*?<strong>([\s\S]*?)<\/strong>/i),
      image: firstMatch(html, /<div class="hero-img">[\s\S]*?<img[^>]+src="([^"]+)"/i),
      status,
    } as FeedEntry & { status: "screening" | "upcoming" };
  } catch {
    return undefined;
  }
}

async function fetchMovies(): Promise<TopicFeed> {
  const indexes = await Promise.all([fetchText("https://eiga.com/now/"), fetchText("https://eiga.com/upcoming/")]);
  const urls = [
    ...movieUrls(indexes[0]).map((url) => ({ url, status: "screening" as const })),
    ...movieUrls(indexes[1]).map((url) => ({ url, status: "upcoming" as const })),
  ].filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index).slice(0, 20);
  const details = (await Promise.all(urls.map((item) => fetchMovieDetails(item.url, item.status)))).filter(
    (entry): entry is FeedEntry & { status: "screening" | "upcoming" } => Boolean(entry),
  );
  if (details.length === 0) throw new Error("No movie entries");
  const items = details.map((entry, index): TopicBoard => ({
    id: `live-movie-${entry.link ?? index}`,
    domain: "movie",
    title: entry.title,
    category: entry.status === "screening" ? "劇場公開中" : "公開予定",
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
    tags: ["映画.com", entry.status === "screening" ? "上映中" : "公開予定"],
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
  ["signal-board-topic-feed-v1"],
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
