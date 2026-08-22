import "server-only";

import { unstable_cache } from "next/cache";
import { events as curatedEvents } from "@/data/events";
import { majorBoxingEvents } from "@/data/majorBoxingEvents";
import { boxingResultEvents } from "@/data/boxingResultEvents";
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
const REVALIDATE_SECONDS = 60 * 60 * 24;
const LIVE_FEED_TIMEOUT_MS = 20_000;
const ENRICHED_FEED_TIMEOUT_MS = 30_000;
const JBC_RESULT_WAIT_MS = 4_000;
const MAX_JBC_RESULT_EVENTS = 24;
const MAX_HISTORY_CARD_DATES = 64;
const PRIORITY_CARD_SERIES = new Set([
  "Lemino Boxing",
  "Dynamic Glove",
  "Prime Video Boxing",
  "3150 FIGHT",
  "Lifetime Boxing Fights",
  "Treasure-Boxing",
  "Phoenix Battle",
]);
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

// 公式シリーズ情報と手入力済みの補完興行は、ライブ取得成功後に
// ライブイベントへ統合する。ライブ取得に失敗した場合のフォールバックには使わない。
const KNOWN_EVENTS = [...majorBoxingEvents, ...curatedEvents];

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
    nameStatus: "inferred",
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

  const remaining = await Promise.allSettled(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchJbcPage(JBC_FINISHED_CATEGORY, index + 2, HISTORY_START),
    ),
  );
  return [
    first,
    ...remaining
      .filter((result): result is PromiseFulfilledResult<{ posts: JbcPost[]; totalPages: number }> => result.status === "fulfilled")
      .map((result) => result.value),
  ].flatMap((result) => result.posts);
}

function latestUpdate(events: BoxingEvent[]): string | undefined {
  return events
    .map((event) => event.sourceUpdatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];
}

async function buildBaseLiveBoxingFeed(): Promise<BoxingFeed> {
  const [boxmobResult, scheduledResult, finishedResult] = await Promise.allSettled([
    fetchBoxmobSchedule(),
    fetchScheduledPosts(),
    fetchFinishedHistory(),
  ]);
  const boxmobSchedule = boxmobResult.status === "fulfilled"
    ? boxmobResult.value
    : [];
  const scheduledPosts = scheduledResult.status === "fulfilled"
    ? scheduledResult.value
    : [];
  const finishedPosts = finishedResult.status === "fulfilled"
    ? finishedResult.value
    : [];
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
    const failures = [boxmobResult, scheduledResult, finishedResult]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
    throw new Error(
      `ライブ取得元から利用可能な興行が返りませんでした${failures.length > 0 ? `: ${failures.join(" / ")}` : ""}`,
    );
  }

  const uniqueEvents = mergeKnownEvents(allJbcEvents, today).filter(
    (event) =>
      event.status === "scheduled" ||
      event.date >= recentCutoff ||
      MAJOR_SERIES.has(event.series ?? ""),
  );
  const storedEvents = mergeStoredBouts(uniqueEvents);
  const unavailableSources: string[] = [];
  if (boxmobResult.status === "rejected") unavailableSources.push("ボクシングモバイル予定");
  if (scheduledResult.status === "rejected") unavailableSources.push("JBC予定");
  if (finishedResult.status === "rejected") unavailableSources.push("JBC結果");
  return {
    events: storedEvents,
    mode: "live",
    sourceName: boxmobSchedule.length > 0
      ? "ボクシングモバイル予定 / JBC結果"
      : "JBC予定・結果 / 公式シリーズ情報",
    updatedAt: latestUpdate(uniqueEvents),
    warning: unavailableSources.length > 0
      ? `${unavailableSources.join("・")}の取得に失敗したため、取得できたライブデータのみ表示しています。`
      : undefined,
  };
}

const getCachedBaseLiveBoxingFeed = unstable_cache(
  buildBaseLiveBoxingFeed,
  ["signal-board-boxing-feed-v40-protect-curated-event-names"],
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
    const events = await Promise.race([
      enrichEventsWithResults(baseFeed.events),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Boxing card enrichment timed out")),
          ENRICHED_FEED_TIMEOUT_MS,
        );
      }),
    ]);
    return {
      ...baseFeed,
      events,
      warning: [baseFeed.warning, unresolvedEventNameWarning(events)]
        .filter(Boolean)
        .join(" ") || undefined,
    };
  } catch (error) {
    console.error("Unable to enrich JBC boxing feed", error);
    return {
      ...baseFeed,
      warning: [
        baseFeed.warning,
        unresolvedEventNameWarning(baseFeed.events),
        "対戦カード・試合結果の追加取得が時間内に完了しなかったため、取得できた興行情報のみ表示しています。",
      ].filter(Boolean).join(" "),
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

function sameMajorEvent(candidate: BoxingEvent, curated: BoxingEvent): boolean {
  if (
    candidate.date !== curated.date ||
    !sameVenue(candidate.venue, curated.venue)
  ) {
    return false;
  }

  const candidateHint = seriesHint(`${candidate.name} ${candidate.series ?? ""}`);
  const curatedHint = seriesHint(`${curated.name} ${curated.series ?? ""}`);
  if (candidateHint && curatedHint && candidateHint !== curatedHint) {
    return false;
  }

  if (candidate.startTime && curated.startTime) {
    return candidate.startTime === curated.startTime;
  }

  if (candidate.name === curated.name || candidate.series === curated.series) {
    return true;
  }

  // 同日・同会場の複数興行を、開始時刻が欠けたデータでも別々に保持する。
  const isLiveSchedule =
    candidate.sourceName === "ボクシングモバイル" ||
    candidate.sourceName === "JBC";
  if (
    candidate.name !== curated.name &&
    !isLiveSchedule
  ) {
    return false;
  }
  return true;
}

function isGenericEventName(event: BoxingEvent): boolean {
  const name = event.name.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  const series = (event.series ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
  return name === series || /興行$/.test(name);
}

function isGenericJbcEventForKnownEvent(
  candidate: BoxingEvent,
  curated: BoxingEvent,
): boolean {
  return (
    candidate.sourceName === "JBC" &&
    candidate.nameStatus === "inferred" &&
    isGenericEventName(candidate) &&
    candidate.date === curated.date &&
    sameVenue(candidate.venue, curated.venue)
  );
}

function seriesFromOfficialName(name: string): string | undefined {
  const normalized = name.normalize("NFKC");
  if (/PHOENIX\s*BATTLE|フェニックス[\s・･]*バトル/i.test(normalized)) {
    return "Phoenix Battle";
  }
  if (/DYNAMIC\s*GLOVE|ダイナミック[\s・･]*グローブ/i.test(normalized)) {
    return "Dynamic Glove";
  }
  if (/TREASURE/i.test(normalized)) return "Treasure-Boxing";
  if (/3150|KWORLD3|LUSH|SAIKOU/i.test(normalized)) return "3150 FIGHT";
  if (/LIFE\s*TIME/i.test(normalized)) return "Lifetime Boxing Fights";
  if (/PRIME\s*VIDEO/i.test(normalized)) return "Prime Video Boxing";
  if (/U-?NEXT/i.test(normalized)) return "U-NEXT Boxing";
  if (/LEMINO/i.test(normalized)) return "Lemino Boxing";
  return undefined;
}

function unresolvedEventNameWarning(events: BoxingEvent[]): string | undefined {
  const unresolved = events.filter(
    (event) =>
      event.nameStatus === "inferred" &&
      MAJOR_SERIES.has(event.series ?? "") &&
      isGenericEventName(event),
  );
  if (unresolved.length === 0) return undefined;
  const labels = unresolved
    .slice(0, 5)
    .map((event) => `${event.date} ${event.name}`)
    .join("、");
  const suffix = unresolved.length > 5 ? `ほか${unresolved.length - 5}件` : "";
  return `正式な興行名を取得できていないため仮名称で表示している興行があります（${labels}${suffix}）。`;
}

function sameEventSlot(left: BoxingEvent, right: BoxingEvent): boolean {
  return (
    left.date === right.date &&
    sameVenue(left.venue, right.venue) &&
    (!left.startTime || !right.startTime || left.startTime === right.startTime) &&
    left.series === right.series
  );
}

function mergeEventBouts(
  preferred: BoxingEvent["bouts"],
  additional: BoxingEvent["bouts"],
): BoxingEvent["bouts"] {
  const merged = [...preferred];
  for (const bout of additional) {
    const index = merged.findIndex((candidate) => samePair(candidate, bout));
    if (index === -1) {
      merged.push(bout);
      continue;
    }
    merged[index] = mergeCardResults([merged[index]], [bout])[0];
  }
  return merged;
}

function reconcileNamedEvents(events: BoxingEvent[]): BoxingEvent[] {
  const reconciled: BoxingEvent[] = [];
  for (const event of events) {
    const duplicateIndex = reconciled.findIndex(
      (candidate) =>
        sameEventSlot(candidate, event) &&
        (isGenericEventName(candidate) || isGenericEventName(event)),
    );
    if (duplicateIndex === -1) {
      reconciled.push(event);
      continue;
    }

    const existing = reconciled[duplicateIndex];
    const preferred = isGenericEventName(existing) && !isGenericEventName(event)
      ? event
      : existing;
    const additional = preferred === event ? existing : event;
    reconciled[duplicateIndex] = {
      ...preferred,
      image: preferred.image ?? additional.image,
      detailsUrl: preferred.detailsUrl ?? additional.detailsUrl,
      sourceUpdatedAt: preferred.sourceUpdatedAt ?? additional.sourceUpdatedAt,
      bouts: mergeEventBouts(preferred.bouts, additional.bouts),
    };
  }
  return reconciled;
}

function mergeKnownEvents(
  events: BoxingEvent[],
  today: string,
): BoxingEvent[] {
  const merged = [...events];

  for (const sourceEvent of KNOWN_EVENTS) {
    const curated: BoxingEvent = {
      ...sourceEvent,
      status: sourceEvent.date > today ? "scheduled" : "finished",
      nameStatus: sourceEvent.nameStatus ?? "official",
      sourceName: sourceEvent.sourceName ?? "公式シリーズ情報",
      bouts: sourceEvent.bouts ?? [],
    };
    const matchedIndex = merged.findIndex((candidate) =>
      sameMajorEvent(candidate, curated),
    );
    const genericIndex = matchedIndex === -1
      ? merged.findIndex((candidate) =>
        isGenericJbcEventForKnownEvent(candidate, curated),
      )
      : -1;
    const existingIndex = matchedIndex !== -1 ? matchedIndex : genericIndex;

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
        bouts: mergeEventBouts(jbcEvent.bouts, curated.bouts),
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
      bouts: mergeEventBouts(jbcEvent.bouts, curated.bouts),
    };
  }

  return reconcileNamedEvents([
    ...new Map(
      merged.map((event) => [
        `${event.date}:${normalizeVenue(event.venue)}:${event.series ?? ""}:${event.startTime ?? ""}:${event.name}`,
        event,
      ]),
    ).values(),
  ]);
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
    const supplementalBouts = [
      ...storedBoutsForEvent(event),
      ...event.bouts,
    ];
    const bouts = cardSet.bouts.length > 0
      ? mergeCardResults(cardSet.bouts, supplementalBouts)
      : supplementalBouts;
    const cardSetEvent = { ...event, name: cardSet.name };
    const hasOfficialName = Boolean(
      event.nameStatus !== "official" &&
      cardSet.name.trim() &&
      !isGenericEventName(cardSetEvent),
    );
    const officialSeries = hasOfficialName
      ? seriesFromOfficialName(cardSet.name)
      : undefined;
    return {
      ...event,
      ...(hasOfficialName
        ? {
            name: cardSet.name,
            nameStatus: "official" as const,
            ...(officialSeries ? { series: officialSeries } : {}),
          }
        : {}),
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

  const numbered3150Dates = [...new Set(
    boxmobTargets
      .filter((event) => event.series === "3150 FIGHT" && !isGenericEventName(event))
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((event) => event.date),
  )];
  const otherPriorityDates = [...new Set(
    boxmobTargets
      .filter((event) => PRIORITY_CARD_SERIES.has(event.series ?? ""))
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((event) => event.date),
  )];
  const priorityDates = [
    ...numbered3150Dates,
    ...otherPriorityDates.filter((date) => !numbered3150Dates.includes(date)),
  ];
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
  const priorityDateSet = new Set(priorityDates);
  const fallbackDates = [...new Set([
    ...latestDates,
    ...majorDates,
  ])].filter((date) => !priorityDateSet.has(date));
  const targetDates = [
    ...priorityDates,
    ...fallbackDates.slice(0, Math.max(0, maxDates - priorityDates.length)),
  ];
  const targetSeriesByDate = new Map<string, Set<string>>();
  for (const event of boxmobTargets) {
    if (!targetDates.includes(event.date)) continue;
    const hint = seriesHint(`${event.name} ${event.series ?? ""}`);
    if (!hint) continue;
    const series = targetSeriesByDate.get(event.date) ?? new Set<string>();
    series.add(hint);
    targetSeriesByDate.set(event.date, series);
  }

  try {
    return await fetchBoxmobHistoryCards(targetDates, targetSeriesByDate);
  } catch (error) {
    console.warn("Unable to load Boxing Mobile historical cards", error);
    return [];
  }
}

function mergeStoredBouts(events: BoxingEvent[]): BoxingEvent[] {
  return events.map((event) => {
    const storedBouts = storedBoutsForEvent(event);
    if (storedBouts.length === 0) return event;
    return {
      ...event,
      bouts: event.bouts.length > 0
        ? mergeCardResults(event.bouts, storedBouts)
        : storedBouts,
    };
  });
}

function storedBoutsForEvent(event: BoxingEvent): BoxingEvent["bouts"] {
  const curated = curatedEvents
    .filter(
      (stored) =>
        stored.date === event.date &&
        Boolean(stored.series && event.series && stored.series === event.series),
    )
    .flatMap((stored) => stored.bouts);
  const catalog = boxingResultEvents
    .filter((stored) =>
      stored.date === event.date &&
      (seriesHint(stored.series) !== "" &&
        seriesHint(stored.series) === seriesHint(`${event.name} ${event.series ?? ""}`)),
    )
    .flatMap((stored) => stored.bouts);
  return [...curated, ...catalog];
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
    samePairInOrder(left, right) || samePairInOrder(left, {
      jpFighter: right.opponent,
      opponent: right.jpFighter,
    })
  );
}

function samePairInOrder(
  left: { jpFighter: string; opponent: string },
  right: { jpFighter: string; opponent: string },
): boolean {
  return sameFighter(left.jpFighter, right.jpFighter) &&
    sameFighter(left.opponent, right.opponent);
}

function resultForPair(
  reference: BoxingEvent["bouts"][number],
  target: BoxingEvent["bouts"][number],
): BoxingEvent["bouts"][number]["result"] {
  if (samePairInOrder(reference, target)) return reference.result;
  if (reference.result === "win") return "loss";
  if (reference.result === "loss") return "win";
  return reference.result;
}

function seriesHint(value: string): string {
  const text = value.normalize("NFKC").toLowerCase();
  // Leminoは配信プラットフォーム名でも使われるため、固有興行名を先に判定する。
  if (text.includes("phoenix") || text.includes("フェニックス")) return "phoenix";
  if (text.includes("lemino")) return "lemino";
  if (text.includes("prime")) return "prime";
  if (text.includes("dynamic glove")) return "dynamic-glove";
  if (text.includes("u-next") || text.includes("unext")) return "unext";
  if (text.includes("treasure")) return "treasure";
  if (
    text.includes("3150") ||
    text.includes("kworld") ||
    text.includes("lush") ||
    text.includes("saikou")
  ) return "3150";
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
    if (eventHint === "3150" && /弁慶|benkei/i.test(cardSet.name)) score += 3;
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
          result: resultForPair(result, card),
          method: result.method,
        }
      : card;
  });
}
