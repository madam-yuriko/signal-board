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
// 手入力結果はカード・勝敗の補完に使い、興行名とシリーズは
// 主催／配信元で確認した majorBoxingEvents を最後に重ねて正とする。
const KNOWN_EVENTS = [...curatedEvents, ...majorBoxingEvents];

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

function jbcResultPdfUrl(post: JbcPost): string | undefined {
  const hrefs = [...post.content.rendered.matchAll(/href\s*=\s*(["'])(.*?)\1/gi)]
    .map((match) => decodeHtml(match[2]).trim())
    .filter((href) => /\.pdf(?:$|[?#])/i.test(href))
    .map((href) => {
      try {
        return new URL(href, post.link).toString();
      } catch {
        return undefined;
      }
    })
    .filter((href): href is string => Boolean(href));
  const preferred = hrefs.find((href) =>
    /(?:kekka|result|report|match[_-]?report|試合結果)/i.test(href),
  );
  if (preferred) return preferred;
  if (hrefs[0]) return hrefs[0];

  const metaLink = post.meta?.["vk-ltc-link"];
  return typeof metaLink === "string" && /\.pdf(?:$|[?#])/i.test(metaLink)
    ? metaLink
    : undefined;
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
  // 古いJBC結果記事にはPDFへのリンクが本文にあるものと、記事URL自体が
  // PDFへリダイレクトするものが混在する。終了済み記事は後者も結果URLとして保持する。
  const detailsUrl = jbcResultPdfUrl(post) ?? (status === "finished" ? post.link : undefined);

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
    cache: "no-store",
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

  if (boxmobResult.status === "rejected") {
    const reason = boxmobResult.reason instanceof Error
      ? boxmobResult.reason.message
      : String(boxmobResult.reason);
    throw new Error(`ボクシングモバイルの予定・対戦カード取得に失敗しました: ${reason}`);
  }

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
  assertNumberedSeriesIntegrity(uniqueEvents);
  const storedEvents = mergeStoredBouts(uniqueEvents);
  const unavailableSources: string[] = [];
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
  ["signal-board-boxing-feed-v48-title-scopes"],
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
    throw new BoxingFeedError(
      "対戦カード・試合結果の取得に失敗しました。不完全な保存済みデータは表示していません。時間を置いて再試行してください。",
      { cause: error },
    );
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

function unextBoxingNumber(event: BoxingEvent): number | undefined {
  if (event.series !== "U-NEXT Boxing") return undefined;
  const match = event.name
    .normalize("NFKC")
    .match(/^U-NEXT\s*BOXING(?:[.\s]*(\d+))?(?:\b|\[|$)/i);
  if (!match) return undefined;
  return match[1] ? Number(match[1]) : 1;
}

function assertNumberedSeriesIntegrity(events: BoxingEvent[]): void {
  const numbered = events
    .flatMap((event) => {
      const number = unextBoxingNumber(event);
      return number ? [{ event, number }] : [];
    })
    .sort((left, right) => left.number - right.number);
  const seen = new Set<number>();
  for (let index = 0; index < numbered.length; index += 1) {
    const current = numbered[index];
    if (seen.has(current.number)) {
      throw new Error(`U-NEXT BOXING ${current.number} が重複しています`);
    }
    seen.add(current.number);
    if (current.number !== index + 1) {
      throw new Error(`U-NEXT BOXING の連番が欠けています: ${current.number}`);
    }
    const previous = numbered[index - 1];
    if (previous && previous.event.date >= current.event.date) {
      throw new Error(
        `U-NEXT BOXING ${previous.number} と ${current.number} の開催日順が逆転しています`,
      );
    }
  }
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
      sourceUrl: jbcEvent.sourceUrl,
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
  const resultUrls = new Map(
    baseEvents.flatMap((event) =>
      event.status === "finished" &&
      event.sourceName?.toLowerCase().includes("jbc") &&
      event.detailsUrl
        ? [[event.id, event.detailsUrl] as const]
        : [],
    ),
  );
  const cardSets = await loadBoxmobCardSets(baseEvents);
  const withCards = mergeBoxmobCards(baseEvents, cardSets);
  return enrichEventsWithJbcResults(withCards, resultUrls);
}

function mergeBoxmobCards(
  events: BoxingEvent[],
  cardSets: BoxmobCardSet[],
): BoxingEvent[] {
  const assignments = assignCardSets(events, cardSets);
  assertExactCardAssignments(events, assignments);

  return events.map((event, index) => {
    if (
      event.status !== "finished" ||
      event.detailsUrl?.toLowerCase().includes("boxmob.jp/sp/schedule/index.html")
    ) {
      return event;
    }
    const cardSet = assignments.get(index);
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

function assertExactCardAssignments(
  events: BoxingEvent[],
  assignments: Map<number, BoxmobCardSet>,
): void {
  events.forEach((event, index) => {
    if (
      event.status !== "finished" ||
      event.series !== "U-NEXT Boxing" ||
      !event.boxmobSid
    ) {
      return;
    }
    const assigned = assignments.get(index);
    if (assigned?.sid !== event.boxmobSid || assigned.bouts.length === 0) {
      throw new Error(
        `${event.name} の対戦カード（BoxMob SID ${event.boxmobSid}）を取得できませんでした`,
      );
    }
  });
}

async function enrichEventsWithJbcResults(
  events: BoxingEvent[],
  resultUrls: Map<string, string>,
): Promise<BoxingEvent[]> {
  const enriched = events.map((event) => ({ ...event }));
  const targets = enriched
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event }) =>
        event.status === "finished" &&
        event.bouts.length > 0 &&
        resultUrls.has(event.id),
    )
    .sort((left, right) => right.event.date.localeCompare(left.event.date));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(8, targets.length) }, async () => {
      while (cursor < targets.length) {
        const target = targets[cursor];
        cursor += 1;
        try {
          const bouts = await parseJbcResultPdf(
            resultUrls.get(target.event.id)!,
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
  // BoxMob SIDを公式カタログ側で固定した興行は、件数上限より先に必ず取得する。
  // これを通常の「直近／主要シリーズ」枠へ混ぜると、主要興行が増えた時に
  // 古いU-NEXT BOXINGが上限の外へ押し出され、保存済みの主要試合だけになる。
  const exactCardDates = [...new Set(
    boxmobTargets
      .filter((event) => Boolean(event.boxmobSid))
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
    ...exactCardDates,
    ...numbered3150Dates,
    ...otherPriorityDates.filter(
      (date) => !exactCardDates.includes(date) && !numbered3150Dates.includes(date),
    ),
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
  if (a === b || (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a)))) {
    return true;
  }
  // 海外選手は媒体によってミドルネームが省略されることがある。
  // 先頭と末尾が十分一致する場合だけ、同一人物として扱う。
  return a.length >= 7 && b.length >= 7 &&
    a.slice(0, 3) === b.slice(0, 3) &&
    a.slice(-4) === b.slice(-4);
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

function cardSetMatchScore(event: BoxingEvent, cardSet: BoxmobCardSet): number {
  if (event.date !== cardSet.date) return Number.NEGATIVE_INFINITY;
  if (event.boxmobSid === cardSet.sid) return 10_000;
  const eventHint = seriesHint(`${event.name} ${event.series ?? ""}`);
  const cardHint = seriesHint(cardSet.name);
  let score = 0;
  if (eventHint && eventHint === cardHint) score += 40;
  if (eventHint && cardHint && eventHint !== cardHint) score -= 100;
  if (eventHint === "3150" && /弁慶|benkei/i.test(cardSet.name)) score += 30;
  for (const resultBout of event.bouts) {
    if (cardSet.bouts.some((cardBout) => samePair(resultBout, cardBout))) score += 100;
  }
  const normalizedCardName = cardSet.name.normalize("NFKC").toLowerCase();
  const eventTokens = event.name
    .normalize("NFKC")
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  score += eventTokens.filter((token) => normalizedCardName.includes(token)).length * 2;
  if (event.nameStatus === "official") score += 10;
  if (isGenericEventName(event)) score -= 5;
  return score;
}

function assignCardSets(
  events: BoxingEvent[],
  cardSets: BoxmobCardSet[],
): Map<number, BoxmobCardSet> {
  const eligible = events
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event }) =>
        event.status === "finished" &&
        !event.detailsUrl?.toLowerCase().includes("boxmob.jp/sp/schedule/index.html"),
    );
  const eventCountByDate = new Map<string, number>();
  const cardCountByDate = new Map<string, number>();
  for (const { event } of eligible) {
    eventCountByDate.set(event.date, (eventCountByDate.get(event.date) ?? 0) + 1);
  }
  for (const cardSet of cardSets) {
    cardCountByDate.set(cardSet.date, (cardCountByDate.get(cardSet.date) ?? 0) + 1);
  }

  const proposals = eligible.flatMap(({ event, index }) =>
    cardSets
      .filter((cardSet) => cardSet.date === event.date)
      .map((cardSet) => {
        const onlyEventAndCard =
          eventCountByDate.get(event.date) === 1 &&
          cardCountByDate.get(event.date) === 1;
        return {
          eventIndex: index,
          cardSet,
          score: cardSetMatchScore(event, cardSet) + (onlyEventAndCard ? 1 : 0),
        };
      }),
  ).sort((left, right) => right.score - left.score);

  const assignments = new Map<number, BoxmobCardSet>();
  const usedCardSids = new Set<string>();
  for (const proposal of proposals) {
    if (proposal.score <= 0) continue;
    if (assignments.has(proposal.eventIndex) || usedCardSids.has(proposal.cardSet.sid)) {
      continue;
    }
    assignments.set(proposal.eventIndex, proposal.cardSet);
    usedCardSids.add(proposal.cardSet.sid);
  }
  return assignments;
}

function mergeCardResults(cards: BoxingEvent["bouts"], results: BoxingEvent["bouts"]): BoxingEvent["bouts"] {
  const positionalResults = new Map<number, BoxingEvent["bouts"][number]>();
  for (const result of results) {
    if (
      !result.jpFighter.startsWith("__jbc_red_") ||
      !result.opponent.startsWith("__jbc_blue_")
    ) continue;
    const boutNumber = Number(result.id.match(/-b(\d+)$/)?.[1]);
    if (Number.isInteger(boutNumber) && boutNumber > 0) {
      positionalResults.set(boutNumber, result);
    }
  }

  return cards.map((card, index) => {
    const namedResult = results.find((candidate) => samePair(card, candidate));
    // Boxing Mobileはメインから、JBCは第1試合から並ぶため順序が逆。
    const positionalResult = positionalResults.get(cards.length - index);
    const result = namedResult ?? positionalResult;
    return result
      ? {
          ...card,
          jpFighterGym: card.jpFighterGym ?? result.jpFighterGym,
          jpFighterCountry: card.jpFighterCountry ?? result.jpFighterCountry,
          opponentCountry: card.opponentCountry ?? result.opponentCountry,
          opponentGym: card.opponentGym ?? result.opponentGym,
          weightClass:
            card.weightClass === "契約階級" && result.weightClass !== "契約階級"
              ? result.weightClass
              : card.weightClass,
          // 結果PDFの行にはランキング等の団体名が混ざるため、タイトル情報は
          // 公式対戦カードの見出しだけを正とする。
          organizations: card.organizations,
          titles: card.titles,
          result: namedResult ? resultForPair(result, card) : result.result,
          method: result.method,
        }
      : card;
  });
}
