import "server-only";

import { events as fallbackEvents } from "@/data/events";
import type { BoxingEvent } from "@/types";

const JBC_API = "https://jbc.or.jp/wp-json/wp/v2/posts";
const JBC_SCHEDULED_CATEGORY = 5;
const JBC_FINISHED_CATEGORY = 6;
const REVALIDATE_SECONDS = 60 * 60 * 6;

interface JbcPost {
  id: number;
  modified: string;
  modified_gmt?: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  meta?: Record<string, unknown>;
}

export interface BoxingFeed {
  events: BoxingEvent[];
  mode: "live" | "fallback";
  sourceName: string;
  updatedAt?: string;
}

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
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function tableValue(html: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(
      `<td[^>]*>\\s*${escaped}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
      "i",
    ),
  );
  return match ? plainText(match[1]) : undefined;
}

function cityForVenue(venue: string): string {
  const places: Array<[RegExp, string]> = [
    [/後楽園ホール|東京ドーム|両国国技館|有明アリーナ/, "東京"],
    [/横浜|BUNTA/i, "横浜"],
    [/大阪|住吉区|堺市|エルシアター|176BOX/i, "大阪"],
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
  return places.find(([pattern]) => pattern.test(venue))?.[1] ?? "日本";
}

function parsePost(
  post: JbcPost,
  status: NonNullable<BoxingEvent["status"]>,
): BoxingEvent | null {
  const title = plainText(post.title.rendered);
  const match = title.match(
    /^(\d{4})年(\d{1,2})月(\d{1,2})日\s*(.+)$/,
  );
  if (!match) return null;

  const [, year, month, day, titleVenue] = match;
  const venue = tableValue(post.content.rendered, "場所") ?? titleVenue.trim();
  const promoter = tableValue(post.content.rendered, "プロモーター");
  const detailsUrl =
    typeof post.meta?.["vk-ltc-link"] === "string" &&
    post.meta["vk-ltc-link"].startsWith("https://")
      ? post.meta["vk-ltc-link"]
      : undefined;

  return {
    id: `jbc-${post.id}`,
    date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    status,
    name: promoter ? `${promoter}興行` : `${venue}興行`,
    series: promoter,
    venue,
    city: cityForVenue(venue),
    domestic: true,
    sourceName: "JBC",
    sourceUrl: post.link,
    detailsUrl,
    sourceUpdatedAt: post.modified_gmt
      ? `${post.modified_gmt}Z`
      : `${post.modified}+09:00`,
    bouts: [],
  };
}

function tokyoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return tokyoDate(date);
}

async function fetchJbcPosts(category: number): Promise<JbcPost[]> {
  const params = new URLSearchParams({
    categories: String(category),
    per_page: "100",
    orderby: "modified",
    order: "desc",
    _fields: "id,modified,modified_gmt,link,title,content,meta",
  });

  const response = await fetch(`${JBC_API}?${params}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`JBC API returned ${response.status}`);
  }
  return (await response.json()) as JbcPost[];
}

function latestUpdate(events: BoxingEvent[]): string | undefined {
  return events
    .map((event) => event.sourceUpdatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];
}

export async function getBoxingFeed(): Promise<BoxingFeed> {
  try {
    const [scheduledPosts, finishedPosts] = await Promise.all([
      fetchJbcPosts(JBC_SCHEDULED_CATEGORY),
      fetchJbcPosts(JBC_FINISHED_CATEGORY),
    ]);
    const today = tokyoDate(new Date());
    const recentCutoff = daysAgoIso(180);
    const liveEvents = [
      ...scheduledPosts
        .map((post) => parsePost(post, "scheduled"))
        .filter((event): event is BoxingEvent => Boolean(event))
        .filter((event) => event.date >= today),
      ...finishedPosts
        .map((post) => parsePost(post, "finished"))
        .filter((event): event is BoxingEvent => Boolean(event))
        .filter(
          (event) => event.date >= recentCutoff && event.date <= today,
        ),
    ];

    if (liveEvents.length === 0) {
      throw new Error("JBC API returned no usable events");
    }

    const uniqueEvents = [
      ...new Map(
        liveEvents.map((event) => [
          `${event.date}:${event.venue}`,
          event,
        ]),
      ).values(),
    ];

    return {
      events: uniqueEvents,
      mode: "live",
      sourceName: "日本ボクシングコミッション",
      updatedAt: latestUpdate(uniqueEvents),
    };
  } catch (error) {
    console.error("Unable to load JBC boxing feed", error);
    return {
      events: fallbackEvents,
      mode: "fallback",
      sourceName: "ローカル保存データ",
    };
  }
}
