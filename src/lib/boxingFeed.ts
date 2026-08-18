import "server-only";

import { unstable_cache } from "next/cache";
import { events as curatedEvents } from "@/data/events";
import { majorBoxingEvents } from "@/data/majorBoxingEvents";
import {
  fetchBoxmobHistoryCards,
  fetchBoxmobSchedule,
  type BoxmobCardSet,
} from "@/lib/boxmobSchedule";
import { parseJbcResultPdf } from "@/lib/jbcResultPdf";
import type { BoxingEvent } from "@/types";

const JBC_API = "https://jbc.or.jp/wp-json/wp/v2/posts";
const JBC_SCHEDULED_CATEGORY = 5;
const JBC_FINISHED_CATEGORY = 6;
const REVALIDATE_SECONDS = 60 * 60 * 6;
const LIVE_FEED_TIMEOUT_MS = 15_000;
const ENRICHED_FEED_TIMEOUT_MS = 5_000;
const JBC_RESULT_WAIT_MS = 1_500;
const MAX_JBC_RESULT_EVENTS = 24;
const MAX_HISTORY_CARD_DATES = 48;
const PRIORITY_CARD_DATES = 32;
const PRIORITY_CARD_SERIES = new Set(["Dynamic Glove", "Prime Video Boxing"]);
const HISTORY_START = "2021-01-01T00:00:00";
const MAX_HISTORY_PAGES = 10;

const MAJOR_SERIES = new Set([
  "Lemino Boxing",
  "Phoenix Battle",
  "Prime Video Boxing",
  "U-NEXT Boxing",
  "Dynamic Glove",
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
  mode: "live";
  sourceName: string;
  updatedAt?: string;
  warning?: string;
}

export class BoxingFeedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BoxingFeedError";
  }
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

async function buildBaseLiveBoxingFeed(): Promise<BoxingFeed> {
  const [boxmobSchedule, scheduledPosts, finishedPosts] = await Promise.all([
    fetchBoxmobSchedule(),
    fetchScheduledPosts(),
    fetchFinishedHistory(),
  ]);
  const today = tokyoDate(new Date());
  const recentCutoff = daysAgoIso(180);
  const jbcScheduledEvents = scheduledPosts
    .map((post) => parsePost(post, "scheduled"))
    .filter((event): event is BoxingEvent => Boolean(event))
    .filter((event) => event.date >= today);
  const scheduledEvents = boxmobSchedule.length > 0
    ? boxmobSchedule.filter((event) => event.date >= today)
    : jbcScheduledEvents;
  const allJbcEvents = [
    ...scheduledEvents,
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
  const storedEvents = mergeStoredBouts(uniqueEvents);
  const priorityCardSets = await loadBoxmobCardSets(
    storedEvents,
    PRIORITY_CARD_DATES,
  );
  return {
    events: mergeBoxmobCards(storedEvents, priorityCardSets),
    mode: "live",
    sourceName: boxmobSchedule.length > 0
      ? "ボクシングモバイル予定 / JBC結果"
      : "JBC予定・結果 / 公式シリーズ情報",
    updatedAt: latestUpdate(uniqueEvents),
  };
}

const getCachedBaseLiveBoxingFeed = unstable_cache(
  buildBaseLiveBoxingFeed,
  ["signal-board-boxing-feed-v20-base-fighter-annotations"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: ["boxing-feed"],
  },
);

const getCachedEnrichedLiveBoxingFeed = unstable_cache(
  async (): Promise<BoxingFeed> => {
    const baseFeed = await getCachedBaseLiveBoxingFeed();
    return {
      ...baseFeed,
      events: await enrichEventsWithResults(baseFeed.events),
    };
  },
  ["signal-board-boxing-feed-v20-enriched-fighter-annotations"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: ["boxing-feed"],
  },
);

export async function getBoxingFeed(): Promise<BoxingFeed> {
  let baseFeed: BoxingFeed;
  try {
    baseFeed = await Promise.race([
      getCachedBaseLiveBoxingFeed(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Boxing feed request timed out")),
          LIVE_FEED_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (error) {
    console.error("Unable to load JBC boxing feed", error);
    throw new BoxingFeedError(
      "ボクシングモバイルとJBCから最新データを取得できませんでした。保存済みデータへのフォールバックは行っていません。時間を置いて再試行してください。",
      { cause: error },
    );
  }

  try {
    return await Promise.race([
      getCachedEnrichedLiveBoxingFeed(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Boxing card enrichment timed out")),
          ENRICHED_FEED_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (error) {
    console.error("Unable to enrich JBC boxing feed", error);
    return {
      ...baseFeed,
      warning:
        "対戦カード・試合結果の追加取得が完了しなかったため、取得済みの最新データのみ表示しています。",
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
    if (jbcEvent.sourceName === "ボクシングモバイル") {
      merged[existingIndex] = {
        ...curated,
        ...jbcEvent,
        name: curated.name,
        series: curated.series,
        image: jbcEvent.image ?? curated.image,
      };
      continue;
    }
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
  const baseEvents = mergeStoredBouts(events);
  const [withJbcResults, cardSets] = await Promise.all([
    Promise.race([
      enrichEventsWithJbcResults(baseEvents),
      new Promise<BoxingEvent[]>((resolve) => {
        setTimeout(() => resolve(baseEvents), JBC_RESULT_WAIT_MS);
      }),
    ]),
    loadBoxmobCardSets(baseEvents),
  ]);

  return mergeBoxmobCards(withJbcResults, cardSets);
}

function mergeBoxmobCards(
  events: BoxingEvent[],
  cardSets: BoxmobCardSet[],
): BoxingEvent[] {
  if (cardSets.length === 0) return events;

  return events.map((event) => {
    if (
      event.status !== "finished" ||
      event.detailsUrl?.toLowerCase().includes("boxmob.jp/sp/schedule/index.html")
    ) {
      return event;
    }
    const cardSet = selectCardSet(event, cardSets);
    if (!cardSet) return event;
    const bouts = mergeCardResults(cardSet.bouts, event.bouts);
    return {
      ...event,
      sourceName: "ボクシングモバイル / JBC結果",
      detailsUrl: cardSet.detailsUrl,
      sourceUpdatedAt: event.sourceUpdatedAt,
      bouts,
    };
  });
}

async function enrichEventsWithJbcResults(
  events: BoxingEvent[],
): Promise<BoxingEvent[]> {
  const enriched = events.map((event) => ({ ...event }));
  const targets = enriched
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event }) =>
        event.status === "finished" &&
        Boolean(event.detailsUrl?.toLowerCase().includes(".pdf")),
    )
    .sort((left, right) => right.event.date.localeCompare(left.event.date))
    .slice(0, MAX_JBC_RESULT_EVENTS);
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
            enriched[target.index] = {
              ...target.event,
              bouts: target.event.bouts.length > 0
                ? mergeCardResults(target.event.bouts, bouts)
                : bouts,
            };
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

async function loadBoxmobCardSets(
  events: BoxingEvent[],
  maxDates = MAX_HISTORY_CARD_DATES,
): Promise<BoxmobCardSet[]> {
  const boxmobTargets = events.filter(
    (event) =>
      event.status === "finished" &&
      !event.detailsUrl?.toLowerCase().includes("boxmob.jp/sp/schedule/index.html"),
  );
  if (boxmobTargets.length === 0) return [];

  const priorityDates = [...new Set(
    boxmobTargets
      .filter((event) => PRIORITY_CARD_SERIES.has(event.series ?? ""))
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((event) => event.date),
  )];
  const latestDates = [...new Set(
    boxmobTargets
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((event) => event.date),
  )].slice(0, Math.floor(maxDates / 2));
  const majorDates = [...new Set(
    boxmobTargets
      .filter((event) => MAJOR_SERIES.has(event.series ?? ""))
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((event) => event.date),
  )].slice(0, Math.ceil(maxDates / 2));
  const targetDates = [...new Set([...latestDates, ...majorDates])].slice(
    0,
    maxDates,
  );
  targetDates.unshift(...priorityDates.filter((date) => !targetDates.includes(date)));
  targetDates.splice(maxDates);

  try {
    return await fetchBoxmobHistoryCards(targetDates);
  } catch (error) {
    console.warn("Unable to load Boxing Mobile historical cards", error);
    return [];
  }
}

function mergeStoredBouts(events: BoxingEvent[]): BoxingEvent[] {
  return events.map((event) => {
    if (event.bouts.length > 0) return event;
    const matches = curatedEvents.filter(
      (stored) =>
        stored.date === event.date && sameVenue(stored.venue, event.venue),
    );
    if (matches.length !== 1 || matches[0].bouts.length === 0) return event;
    return {
      ...event,
      bouts: matches[0].bouts,
    };
  });
}

function normalizeFighterName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function sameFighter(left: string, right: string): boolean {
  const a = normalizeFighterName(left);
  const b = normalizeFighterName(right);
  return a === b || (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a)));
}

function samePair(left: { jpFighter: string; opponent: string }, right: { jpFighter: string; opponent: string }): boolean {
  return (
    (sameFighter(left.jpFighter, right.jpFighter) && sameFighter(left.opponent, right.opponent)) ||
    (sameFighter(left.jpFighter, right.opponent) && sameFighter(left.opponent, right.jpFighter))
  );
}

function seriesHint(value: string): string {
  const text = value.normalize("NFKC").toLowerCase();
  if (text.includes("lemino")) return "lemino";
  if (text.includes("prime")) return "prime";
  if (text.includes("dynamic glove")) return "dynamic-glove";
  if (text.includes("u-next") || text.includes("unext")) return "unext";
  if (text.includes("treasure")) return "treasure";
  if (text.includes("3150") || text.includes("kworld")) return "3150";
  if (text.includes("phoenix") || text.includes("フェニックス")) return "phoenix";
  if (text.includes("lifetime")) return "lifetime";
  return "";
}

function selectCardSet(event: BoxingEvent, cardSets: BoxmobCardSet[]): BoxmobCardSet | undefined {
  if (event.boxmobSid) {
    const explicit = cardSets.find((cardSet) => cardSet.sid === event.boxmobSid);
    if (explicit) return explicit;
  }
  const sameDate = cardSets.filter((cardSet) => cardSet.date === event.date);
  if (sameDate.length === 0) return undefined;
  if (sameDate.length === 1) return sameDate[0];

  const eventHint = seriesHint(`${event.name} ${event.series ?? ""}`);
  const scored = sameDate.map((cardSet) => {
    let score = 0;
    const cardHint = seriesHint(cardSet.name);
    if (eventHint && eventHint === cardHint) score += 4;
    for (const resultBout of event.bouts) {
      if (cardSet.bouts.some((cardBout) => samePair(resultBout, cardBout))) score += 10;
    }
    const eventTokens = event.name.normalize("NFKC").toLowerCase().split(/\s+/).filter((token) => token.length >= 3);
    score += eventTokens.filter((token) => cardSet.name.normalize("NFKC").toLowerCase().includes(token)).length;
    return { cardSet, score };
  });
  scored.sort((left, right) => right.score - left.score);
  const best = scored[0];
  const runnerUp = scored[1];
  if (!best || best.score <= 0 || (runnerUp && runnerUp.score === best.score)) {
    console.warn(`Ambiguous Boxing Mobile card match for ${event.date} ${event.name}`);
    return undefined;
  }
  return best.cardSet;
}

function mergeCardResults(cards: BoxingEvent["bouts"], results: BoxingEvent["bouts"]): BoxingEvent["bouts"] {
  return cards.map((card) => {
    const result = results.find((candidate) => samePair(card, candidate));
    return result
      ? {
          ...card,
          jpFighterGym: card.jpFighterGym ?? result.jpFighterGym,
          jpFighterCountry: card.jpFighterCountry ?? result.jpFighterCountry,
          opponentCountry: card.opponentCountry ?? result.opponentCountry,
          opponentGym: card.opponentGym ?? result.opponentGym,
          result: result.result,
          method: result.method,
        }
      : card;
  });
}
