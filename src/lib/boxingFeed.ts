import "server-only";

import { events as fallbackEvents } from "@/data/events";
import { majorBoxingEvents } from "@/data/majorBoxingEvents";
import { parseJbcResultPdf } from "@/lib/jbcResultPdf";
import type { BoxingEvent } from "@/types";

const JBC_API = "https://jbc.or.jp/wp-json/wp/v2/posts";
const JBC_SCHEDULED_CATEGORY = 5;
const JBC_FINISHED_CATEGORY = 6;
const REVALIDATE_SECONDS = 60 * 60 * 6;
const HISTORY_START = "2021-01-01T00:00:00";
const MAX_HISTORY_PAGES = 10;

const MAJOR_SERIES = new Set([
  "Lemino Boxing",
  "Phoenix Battle",
  "Prime Video Boxing",
  "U-NEXT Boxing",
  "Lifetime Boxing Fights",
  "Treasure-Boxing",
  "3150 FIGHT",
]);

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

function seriesForPromoter(promoter?: string): string | undefined {
  if (!promoter) return undefined;
  if (/大橋(?:プロモーション)?/.test(promoter)) return "Phoenix Battle";
  if (/志成(?:プロモーション)?/.test(promoter)) {
    return "Lifetime Boxing Fights";
  }
  if (/亀田|KWORLD3/i.test(promoter)) return "3150 FIGHT";
  return undefined;
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
  const historicalSeries = seriesForPromoter(promoter);
  const detailsUrl =
    typeof post.meta?.["vk-ltc-link"] === "string" &&
    post.meta["vk-ltc-link"].startsWith("https://")
      ? post.meta["vk-ltc-link"]
      : undefined;

  return {
    id: `jbc-${post.id}`,
    date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    status,
    name: historicalSeries ?? (promoter ? `${promoter}興行` : `${venue}興行`),
    series: historicalSeries ?? promoter,
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

async function fetchJbcPage(
  category: number,
  page = 1,
  after?: string,
): Promise<{ posts: JbcPost[]; totalPages: number }> {
  const params = new URLSearchParams({
    categories: String(category),
    per_page: "100",
    page: String(page),
    orderby: "modified",
    order: "desc",
    _fields: "id,modified,modified_gmt,link,title,content,meta",
  });
  if (after) params.set("after", after);

  const response = await fetch(`${JBC_API}?${params}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`JBC API returned ${response.status}`);
  }
  const totalPages = Math.max(
    1,
    Number.parseInt(response.headers.get("x-wp-totalpages") ?? "1", 10),
  );
  return {
    posts: (await response.json()) as JbcPost[],
    totalPages,
  };
}

async function fetchScheduledPosts(): Promise<JbcPost[]> {
  return (await fetchJbcPage(JBC_SCHEDULED_CATEGORY)).posts;
}

async function fetchFinishedHistory(): Promise<JbcPost[]> {
  const first = await fetchJbcPage(
    JBC_FINISHED_CATEGORY,
    1,
    HISTORY_START,
  );
  const totalPages = Math.min(first.totalPages, MAX_HISTORY_PAGES);
  if (totalPages === 1) return first.posts;

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchJbcPage(JBC_FINISHED_CATEGORY, index + 2, HISTORY_START),
    ),
  );
  return [first, ...remaining].flatMap((result) => result.posts);
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
      fetchScheduledPosts(),
      fetchFinishedHistory(),
    ]);
    const today = tokyoDate(new Date());
    const recentCutoff = daysAgoIso(180);
    const allJbcEvents = [
      ...scheduledPosts
        .map((post) => parsePost(post, "scheduled"))
        .filter((event): event is BoxingEvent => Boolean(event))
        .filter((event) => event.date >= today),
      ...finishedPosts
        .map((post) => parsePost(post, "finished"))
        .filter((event): event is BoxingEvent => Boolean(event))
        .filter((event) => event.date <= today),
    ];

    if (allJbcEvents.length === 0) {
      throw new Error("JBC API returned no usable events");
    }

    const uniqueEvents = mergeMajorEvents(allJbcEvents, today).filter(
      (event) =>
        event.status === "scheduled" ||
        event.date >= recentCutoff ||
        MAJOR_SERIES.has(event.series ?? ""),
    );
    const eventsWithResults = await enrichEventsWithResults(uniqueEvents);

    return {
      events: eventsWithResults,
      mode: "live",
      sourceName: "公式シリーズ情報 / 日本ボクシングコミッション",
      updatedAt: latestUpdate(eventsWithResults),
    };
  } catch (error) {
    console.error("Unable to load JBC boxing feed", error);
    const today = tokyoDate(new Date());
    return {
      events: mergeMajorEvents(fallbackEvents, today),
      mode: "fallback",
      sourceName: "公式シリーズ情報 / ローカル保存データ",
    };
  }
}
function normalizeVenue(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/toyota arena tokyo/g, "トヨタアリーナ東京")
    .replace(/aichi sky expo/g, "愛知県国際展示場")
    .replace(/tokyo aria?ke arena/g, "有明アリーナ")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/(?:東京|大阪|神奈川)[・]/g, "")
    .replace(/\s/g, "")
    .replace(/[・･_/-]/g, "");
}

function sameVenue(left: string, right: string): boolean {
  const a = normalizeVenue(left);
  const b = normalizeVenue(right);
  return a === b || a.includes(b) || b.includes(a);
}

function mergeMajorEvents(
  events: BoxingEvent[],
  today: string,
): BoxingEvent[] {
  const merged = [...events];

  for (const sourceEvent of majorBoxingEvents) {
    const curated: BoxingEvent = {
      ...sourceEvent,
      status: sourceEvent.date > today ? "scheduled" : "finished",
      bouts: sourceEvent.bouts ?? [],
    };
    const existingIndex = merged.findIndex(
      (candidate) =>
        candidate.date === curated.date &&
        sameVenue(candidate.venue, curated.venue),
    );

    if (existingIndex === -1) {
      merged.push(curated);
      continue;
    }

    const jbcEvent = merged[existingIndex];
    merged[existingIndex] = {
      ...jbcEvent,
      ...curated,
      id: jbcEvent.id,
      sourceName: `${curated.sourceName} / JBC`,
      detailsUrl: jbcEvent.detailsUrl,
      sourceUpdatedAt: jbcEvent.sourceUpdatedAt,
      bouts: jbcEvent.bouts.length > 0 ? jbcEvent.bouts : curated.bouts,
    };
  }

  return [
    ...new Map(
      merged.map((event) => [
        `${event.date}:${normalizeVenue(event.venue)}:${event.series ?? ""}`,
        event,
      ]),
    ).values(),
  ];
}
async function enrichEventsWithResults(
  events: BoxingEvent[],
): Promise<BoxingEvent[]> {
  const enriched = events.map((event) => ({ ...event }));
  const targets = enriched
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event }) =>
        event.status === "finished" &&
        event.bouts.length === 0 &&
        Boolean(event.detailsUrl?.toLowerCase().includes(".pdf")),
    );
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(8, targets.length) }, async () => {
      while (cursor < targets.length) {
        const target = targets[cursor];
        cursor += 1;
        try {
          const bouts = await parseJbcResultPdf(
            target.event.detailsUrl!,
            target.event.id,
          );
          if (bouts.length > 0) {
            enriched[target.index] = { ...target.event, bouts };
          }
        } catch (error) {
          console.warn(
            `Unable to parse JBC result PDF for ${target.event.id}`,
            error,
          );
        }
      }
    }),
  );

  return enriched;
}
