import type { Bout, BoutResult, BoxingEvent, Organization } from "@/types";
import { isEventUpcoming, weightRank } from "@/lib/format";

/** イベント情報を持ったまま個々の試合を扱うための型 */
export interface BoutWithEvent extends Bout {
  event: BoxingEvent;
}

export interface Filters {
  query: string;
  series: string[];
  organizations: Organization[];
  weightClasses: string[];
  results: BoutResult[];
  domesticOnly: boolean;
  /** all = 全て / scheduled = 予定のみ / finished = 開催済みのみ */
  status: "all" | "scheduled" | "finished";
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  series: [],
  organizations: [],
  weightClasses: [],
  results: [],
  domesticOnly: false,
  status: "all",
};

export interface EventFilters {
  query: string;
  series: string[];
  status: "all" | "scheduled" | "finished";
  domesticOnly: boolean;
}

export const EMPTY_EVENT_FILTERS: EventFilters = {
  query: "",
  series: [],
  status: "all",
  domesticOnly: false,
};

/** 全イベントの試合を1次元配列に展開 */
export function flattenBouts(events: BoxingEvent[]): BoutWithEvent[] {
  return events.flatMap((event) =>
    event.bouts.map((bout) => ({ ...bout, event })),
  );
}

/** データ内に存在する階級一覧（軽い順） */
export function availableWeightClasses(events: BoxingEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) for (const b of e.bouts) set.add(b.weightClass);
  return [...set].sort((a, b) => weightRank(a) - weightRank(b));
}

const SERIES_TAGS = [
  ["Lemino Boxing", "Lemino Boxing"],
  ["Phoenix Battle", "Phoenix Battle"],
  ["Prime Video Boxing", "Prime Video Boxing"],
  ["U-NEXT Boxing", "U-NEXT Boxing"],
  ["Lifetime Boxing Fights", "Lifetime Boxing Fights"],
  ["Treasure-Boxing", "Treasure-Boxing"],
  ["3150 Fight", "3150 FIGHT"],
] as const;

const OVERSEAS_TAG = "\u6d77\u5916\u306e\u8208\u884c";
const OTHER_TAG = "\u305d\u306e\u4ed6";

function matchesSeriesTag(event: BoxingEvent, value: string): boolean {
  if (value === OVERSEAS_TAG) return !event.domestic;
  if (value === OTHER_TAG) {
    return event.domestic && !SERIES_TAGS.some(([, source]) => source === event.series);
  }
  const source = SERIES_TAGS.find(([label]) => label === value)?.[1] ?? value;
  return event.series === source;
}

export function availableSeries(events: BoxingEvent[]): string[] {
  void events;
  return [
    ...SERIES_TAGS.map(([label]) => label),
    OVERSEAS_TAG,
    OTHER_TAG,
  ];
}

/** Filters promotion events. */
export function filterPromotionEvents(
  events: BoxingEvent[],
  filters: EventFilters,
): BoxingEvent[] {
  const query = filters.query.trim().toLowerCase();

  return events
    .filter((event) => {
      if (filters.domesticOnly && !event.domestic) return false;
      if (filters.series.length > 0 &&
        !filters.series.some((value) => matchesSeriesTag(event, value))) {
        return false;
      }

      const upcoming = isEventUpcoming(event);
      if (filters.status === "scheduled" && !upcoming) return false;
      if (filters.status === "finished" && upcoming) return false;

      if (!query) return true;
      return [
        event.name,
        event.series,
        event.venue,
        event.city,
        event.broadcaster,
        ...event.bouts.flatMap((bout) => [
          bout.jpFighter,
          bout.opponent,
          bout.weightClass,
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function activeEventFilterCount(filters: EventFilters): number {
  return (
    (filters.query.trim() ? 1 : 0) +
    filters.series.length +
    (filters.status !== "all" ? 1 : 0) +
    (filters.domesticOnly ? 1 : 0)
  );
}

/** 1試合がフィルタ条件に一致するか */
function boutMatches(bout: BoutWithEvent, f: Filters): boolean {
  if (f.domesticOnly && !bout.event.domestic) return false;

  if (
    f.series.length > 0 &&
    !f.series.some((value) => matchesSeriesTag(bout.event, value))
  )
    return false;

  if (f.status === "scheduled" && bout.result !== "scheduled") return false;
  if (f.status === "finished" && bout.result === "scheduled") return false;

  if (f.organizations.length > 0) {
    if (!bout.organizations.some((o) => f.organizations.includes(o)))
      return false;
  }

  if (f.weightClasses.length > 0 && !f.weightClasses.includes(bout.weightClass))
    return false;

  if (f.results.length > 0 && !f.results.includes(bout.result)) return false;

  if (f.query.trim()) {
    const q = f.query.trim().toLowerCase();
    const haystack = [
      bout.jpFighter,
      bout.opponent,
      bout.weightClass,
      bout.event.name,
      bout.event.series,
      bout.event.venue,
      bout.event.city,
      bout.organizations.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}

/** フィルタ済みの試合一覧（新しい順） */
export function filterBouts(
  bouts: BoutWithEvent[],
  f: Filters,
): BoutWithEvent[] {
  return bouts
    .filter((b) => boutMatches(b, f))
    .sort((a, b) => b.event.date.localeCompare(a.event.date));
}

/**
 * イベント単位でフィルタを適用。
 * 条件に一致した試合だけを残したイベントを返す（試合が0件のイベントは除外）。
 */
export function filterEvents(events: BoxingEvent[], f: Filters): BoxingEvent[] {
  return events
    .map((event) => {
      const bouts = event.bouts.filter((bout) =>
        boutMatches({ ...bout, event }, f),
      );
      return { ...event, bouts };
    })
    .filter((event) => event.bouts.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.query.trim() ? 1 : 0) +
    f.series.length +
    f.organizations.length +
    f.weightClasses.length +
    f.results.length +
    (f.domesticOnly ? 1 : 0) +
    (f.status !== "all" ? 1 : 0)
  );
}
