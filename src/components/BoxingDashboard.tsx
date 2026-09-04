"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Database, Trophy } from "lucide-react";
import type { BoxingEvent } from "@/types";
import {
  availableSeries,
  EMPTY_EVENT_FILTERS,
  filterPromotionEvents,
  flattenBouts,
  type EventFilters,
} from "@/lib/filters";
import { isEventUpcoming } from "@/lib/format";
import EventFilterBar from "@/components/EventFilterBar";
import EventCard from "@/components/EventCard";
import StatCards, { type Stat } from "@/components/StatCards";
import DataViewToolbar, {
  type DataViewMode,
} from "@/components/DataViewToolbar";
import { DATA_TABLE_PAGE_SIZE } from "@/components/DataTable";
import BoxingDataTable, {
  availableFighterWeightClasses,
  availableFighters,
  boutsForTable,
  managedFighterAffiliation,
  managedFighterCountry,
  managedFighters,
  type ManagedFighter,
  type BoxingTableView,
} from "@/components/BoxingDataTable";
import EntityPicker from "@/components/EntityPicker";
import FighterRecordSummary from "@/components/FighterRecordSummary";
import { normalizeFighterName } from "@/lib/fighterInfo";
import {
  buildFighterBouts,
  summarizeFighterRecord,
  type WikipediaFighterRecord,
} from "@/lib/fighterRecord";
import type { FighterProfile } from "@/lib/fighterProfile";
import { useCheckedCards } from "@/hooks/useCheckedCards";
import { useFighterRecord } from "@/hooks/useFighterRecord";

interface Props {
  events: BoxingEvent[];
  profiles: FighterProfile[];
  records: Record<string, WikipediaFighterRecord>;
  onFighterDataChange?: (
    profiles: FighterProfile[],
    records: Record<string, WikipediaFighterRecord>,
  ) => void;
  sourceName: string;
  updatedAt?: string;
  warning?: string;
}

interface BoxingNavigationState {
  viewMode: DataViewMode;
  tableView: BoxingTableView;
  selectedFighter: string;
}

const TABLE_VIEW_OPTIONS: Array<{
  value: BoxingTableView;
  label: string;
}> = [
  { value: "events", label: "興行一覧" },
  { value: "bouts", label: "全試合一覧" },
  { value: "fighters", label: "選手一覧" },
  { value: "world", label: "世界戦一覧" },
  { value: "fighter", label: "選手別結果・予定" },
];

const WIKIPEDIA_CHUNK_DELAY_MS = 5_000;
const WIKIPEDIA_RECORD_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000;
type FighterWikipediaFilter = "all" | "has" | "none" | "unknown";
type FighterWikipediaStatus = Exclude<FighterWikipediaFilter, "all">;

function wikipediaStatus(
  fighter: ManagedFighter,
  wikipediaUrls: Record<string, string | null>,
  profiles: Record<string, FighterProfile>,
): FighterWikipediaStatus {
  if (wikipediaUrls[fighter.id] ?? profiles[fighter.id]?.sourceUrl) {
    return "has";
  }
  return wikipediaUrls[fighter.id] === null ? "none" : "unknown";
}

function matchesWikipediaFilter(
  fighter: ManagedFighter,
  filter: FighterWikipediaFilter,
  wikipediaUrls: Record<string, string | null>,
  profiles: Record<string, FighterProfile>,
): boolean {
  return filter === "all" || wikipediaStatus(fighter, wikipediaUrls, profiles) === filter;
}

function isFreshWikipediaRecord(record: WikipediaFighterRecord): boolean {
  const updatedAt = record.updatedAt ? Date.parse(record.updatedAt) : Number.NaN;
  return (
    Number.isFinite(updatedAt) &&
    Date.now() - updatedAt < WIKIPEDIA_RECORD_REFRESH_INTERVAL_MS
  );
}

function formatUpdatedAt(value?: string): string | undefined {
  if (!value) return undefined;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function BoxingDashboard({
  events,
  profiles,
  records,
  onFighterDataChange,
  sourceName,
  updatedAt,
  warning,
}: Props) {
  const [filters, setFilters] =
    useState<EventFilters>(EMPTY_EVENT_FILTERS);
  const [viewMode, setViewMode] = useState<DataViewMode>("cards");
  const [tableView, setTableView] = useState<BoxingTableView>("events");
  const [selectedFighter, setSelectedFighter] = useState("");
  const [fighterWeightClass, setFighterWeightClass] = useState("all");
  const [fighterAffiliation, setFighterAffiliation] = useState("all");
  const [fighterCountry, setFighterCountry] = useState("all");
  const [fighterNameQuery, setFighterNameQuery] = useState("");
  const [fighterWikipediaFilter, setFighterWikipediaFilter] = useState<
    FighterWikipediaFilter
  >("all");
  const [wikipediaLookupRequest, setWikipediaLookupRequest] = useState<{
    filterKey: string;
    fighters: ManagedFighter[];
  }>();
  const [fighterWikipediaUrls, setFighterWikipediaUrls] = useState<
    Record<string, string | null>
  >(() =>
    Object.fromEntries(
      profiles.map((profile) => [profile.fighterKey, profile.sourceUrl]),
    ),
  );
  const [fighterProfilesById, setFighterProfilesById] = useState<
    Record<string, FighterProfile>
  >(() => Object.fromEntries(profiles.map((profile) => [profile.fighterKey, profile])));
  const [fighterRecordsById, setFighterRecordsById] = useState<
    Record<string, WikipediaFighterRecord>
  >(() =>
    Object.fromEntries(
      Object.entries(records).filter(([, record]) =>
        isFreshWikipediaRecord(record),
      ),
    ),
  );
  const [fighterWikipediaLoading, setFighterWikipediaLoading] = useState(false);
  const [fighterWikipediaError, setFighterWikipediaError] = useState<string>();
  const wikipediaLookupInFlight = useRef(new Set<string>());
  const fighterWikipediaUrlsRef = useRef(fighterWikipediaUrls);
  const fighterProfilesByIdRef = useRef(fighterProfilesById);
  const fighterRecordsByIdRef = useRef(fighterRecordsById);
  const navigationHistory = useRef<BoxingNavigationState[]>([]);
  const [checkedOnly, setCheckedOnly] = useState(false);
  const cardScrollPosition = useRef<number | null>(null);
  const {
    checkedItems: checkedEvents,
    checkedCount: checkedEventCount,
    isChecked,
    toggle: toggleCheckedEvent,
  } = useCheckedCards("boxing", events);

  const eventSeries = useMemo(() => availableSeries(events), [events]);
  const filtered = useMemo(() => {
    if (!checkedOnly) return filterPromotionEvents(events, filters);

    return [...checkedEvents].sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      return (left.startTime ?? "").localeCompare(right.startTime ?? "");
    });
  }, [checkedEvents, checkedOnly, events, filters]);
  const filteredBouts = useMemo(() => flattenBouts(filtered), [filtered]);
  const allBouts = useMemo(() => flattenBouts(events), [events]);
  const fighterOptions = useMemo(
    () => availableFighters(allBouts),
    [allBouts],
  );
  const fighterList = useMemo(() => managedFighters(allBouts), [allBouts]);
  const fighterWeightClasses = useMemo(
    () => availableFighterWeightClasses(fighterList),
    [fighterList],
  );
  const normalizedFighterNameQuery = normalizeFighterName(fighterNameQuery);
  const wikipediaLookupFilterKey = JSON.stringify([
    fighterWeightClass,
    fighterAffiliation,
    fighterCountry,
    normalizedFighterNameQuery,
    fighterWikipediaFilter,
  ]);
  const fighterAffiliations = useMemo(
    () => {
      const counts = new Map<string, number>();
      for (const fighter of fighterList) {
        if (
          fighterWeightClass !== "all" &&
          !fighter.weightClasses.includes(fighterWeightClass)
        ) {
          continue;
        }
        if (
          fighterCountry !== "all" &&
          managedFighterCountry(fighter) !== fighterCountry
        ) {
          continue;
        }
        if (
          normalizedFighterNameQuery &&
          !normalizeFighterName(fighter.name).includes(normalizedFighterNameQuery)
        ) {
          continue;
        }
        if (
          !matchesWikipediaFilter(
            fighter,
            fighterWikipediaFilter,
            fighterWikipediaUrls,
            fighterProfilesById,
          )
        ) {
          continue;
        }
        const affiliation = managedFighterAffiliation(fighter);
        counts.set(affiliation, (counts.get(affiliation) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort(
          (left, right) => {
            if (left.name === "所属不明") return 1;
            if (right.name === "所属不明") return -1;
            return (
              right.count - left.count ||
              left.name.localeCompare(right.name, "ja")
            );
          },
        );
    },
    [
      fighterCountry,
      fighterList,
      fighterProfilesById,
      fighterWikipediaFilter,
      fighterWikipediaUrls,
      fighterWeightClass,
      normalizedFighterNameQuery,
    ],
  );
  // 国籍の候補数は、国籍以外の現在の選択条件を反映する。
  // 自身の選択で候補が消えないよう、ここでは国籍フィルタだけ外して集計する。
  const fightersForCountryOptions = useMemo(
    () =>
      fighterList.filter(
        (fighter) =>
          (fighterWeightClass === "all" ||
            fighter.weightClasses.includes(fighterWeightClass)) &&
          (fighterAffiliation === "all" ||
            managedFighterAffiliation(fighter) === fighterAffiliation) &&
          (normalizedFighterNameQuery === "" ||
            normalizeFighterName(fighter.name).includes(
              normalizedFighterNameQuery,
            )) &&
          matchesWikipediaFilter(
            fighter,
            fighterWikipediaFilter,
            fighterWikipediaUrls,
            fighterProfilesById,
          ),
      ),
    [
      fighterAffiliation,
      fighterList,
      fighterProfilesById,
      fighterWikipediaFilter,
      fighterWikipediaUrls,
      fighterWeightClass,
      normalizedFighterNameQuery,
    ],
  );
  const fighterCountries = useMemo(
    () => {
      const counts = new Map<string, number>();
      for (const fighter of fightersForCountryOptions) {
        const country = managedFighterCountry(fighter);
        counts.set(country, (counts.get(country) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((left, right) => {
          if (left.name === "日本") return -1;
          if (right.name === "日本") return 1;
          if (left.name === "不明") return 1;
          if (right.name === "不明") return -1;
          if (left.count !== right.count) return right.count - left.count;
          return left.name.localeCompare(right.name, "ja");
        });
    },
    [fightersForCountryOptions],
  );
  const filteredFighters = useMemo(
    () =>
      fighterList.filter(
        (fighter) =>
          (fighterWeightClass === "all" ||
            fighter.weightClasses.includes(fighterWeightClass)) &&
          (fighterAffiliation === "all" ||
            managedFighterAffiliation(fighter) === fighterAffiliation) &&
          (fighterCountry === "all" ||
            managedFighterCountry(fighter) === fighterCountry) &&
          (normalizedFighterNameQuery === "" ||
            normalizeFighterName(fighter.name).includes(
              normalizedFighterNameQuery,
            )) &&
          matchesWikipediaFilter(
            fighter,
            fighterWikipediaFilter,
            fighterWikipediaUrls,
            fighterProfilesById,
          ),
      ),
    [
      fighterAffiliation,
      fighterCountry,
      fighterList,
      fighterProfilesById,
      fighterWikipediaFilter,
      fighterWikipediaUrls,
      fighterWeightClass,
      normalizedFighterNameQuery,
    ],
  );
  const fighterWikipediaOptionCounts = useMemo(() => {
    let has = 0;
    let none = 0;
    let unknown = 0;
    for (const fighter of fighterList) {
      if (
        (fighterWeightClass !== "all" &&
          !fighter.weightClasses.includes(fighterWeightClass)) ||
        (fighterAffiliation !== "all" &&
          managedFighterAffiliation(fighter) !== fighterAffiliation) ||
        (fighterCountry !== "all" &&
          managedFighterCountry(fighter) !== fighterCountry) ||
        (normalizedFighterNameQuery &&
          !normalizeFighterName(fighter.name).includes(normalizedFighterNameQuery))
      ) {
        continue;
      }
      const status = wikipediaStatus(
        fighter,
        fighterWikipediaUrls,
        fighterProfilesById,
      );
      if (status === "has") has += 1;
      else if (status === "none") none += 1;
      else unknown += 1;
    }
    return { has, none, unknown };
  }, [
    fighterAffiliation,
    fighterCountry,
    fighterList,
    fighterProfilesById,
    fighterWikipediaUrls,
    fighterWeightClass,
    normalizedFighterNameQuery,
  ]);
  const displayFighters = useMemo(
    () =>
      filteredFighters.map((fighter) => {
        const wikipediaRecord = fighterRecordsById[fighter.id];
        if (!wikipediaRecord) return fighter;

        const merged = buildFighterBouts(
          fighter.name,
          boutsForTable(allBouts, "fighter", fighter.name),
          wikipediaRecord,
        );
        return {
          ...fighter,
          record: summarizeFighterRecord(merged.bouts, fighter.name),
        };
      }),
    [allBouts, filteredFighters, fighterRecordsById],
  );
  // Wikipedia確認の候補は、現在の一覧条件に合う選手だけにする。
  // 取得対象は通常時も未確認フィルタ時も先頭20人に限定し、全選手を巡回しない。
  const wikipediaLookupCandidates = useMemo(
    () =>
      fighterList
        .filter(
          (fighter) =>
            (fighterWeightClass === "all" ||
              fighter.weightClasses.includes(fighterWeightClass)) &&
            (fighterAffiliation === "all" ||
              managedFighterAffiliation(fighter) === fighterAffiliation) &&
            (fighterCountry === "all" ||
              managedFighterCountry(fighter) === fighterCountry) &&
            (normalizedFighterNameQuery === "" ||
              normalizeFighterName(fighter.name).includes(
                normalizedFighterNameQuery,
              )),
        )
        .sort((left, right) => {
          const boutCount = right.record.total - left.record.total;
          if (boutCount !== 0) return boutCount;
          const wins = right.record.win - left.record.win;
          if (wins !== 0) return wins;
          return left.record.loss - right.record.loss;
        }),
    [
      fighterAffiliation,
      fighterCountry,
      fighterList,
      fighterWeightClass,
      normalizedFighterNameQuery,
    ],
  );
  const fighterMatches = useMemo(() => {
    const query = normalizeFighterName(filters.query);
    if (!query) return [];
    return fighterOptions
      .filter((name) => normalizeFighterName(name).includes(query))
      .slice(0, 12);
  }, [filters.query, fighterOptions]);
  const fighterView = tableView === "fighter";
  const fighterListView = tableView === "fighters";

  useEffect(() => {
    fighterWikipediaUrlsRef.current = fighterWikipediaUrls;
  }, [fighterWikipediaUrls]);

  useEffect(() => {
    fighterProfilesByIdRef.current = fighterProfilesById;
  }, [fighterProfilesById]);

  useEffect(() => {
    fighterRecordsByIdRef.current = fighterRecordsById;
  }, [fighterRecordsById]);

  useEffect(() => {
    if (!fighterListView) return;
    const defaultLookupFighters =
      fighterWikipediaFilter === "unknown"
        ? wikipediaLookupCandidates.filter(
            (fighter) =>
              wikipediaStatus(
                fighter,
                fighterWikipediaUrlsRef.current,
                fighterProfilesByIdRef.current,
              ) === "unknown",
          )
        : wikipediaLookupCandidates;
    const lookupFighters =
      wikipediaLookupRequest?.filterKey === wikipediaLookupFilterKey
        ? wikipediaLookupRequest.fighters
        : defaultLookupFighters;
    const names = lookupFighters
      .slice(0, DATA_TABLE_PAGE_SIZE)
      .filter(
        (fighter) =>
          (fighterWikipediaUrlsRef.current[fighter.id] === undefined ||
            !fighterRecordsByIdRef.current[fighter.id]) &&
          !wikipediaLookupInFlight.current.has(fighter.id),
      )
      .map((fighter) => fighter.name);
    if (names.length === 0) return;

    names.forEach((name) =>
      wikipediaLookupInFlight.current.add(normalizeFighterName(name)),
    );
    setFighterWikipediaLoading(true);
    setFighterWikipediaError(undefined);
    let cancelled = false;
    const chunks = Array.from(
      { length: Math.ceil(names.length / 250) },
      (_, index) => names.slice(index * 250, (index + 1) * 250),
    );

    void (async () => {
      try {
        for (const [chunkIndex, chunk] of chunks.entries()) {
          if (chunkIndex > 0) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, WIKIPEDIA_CHUNK_DELAY_MS),
            );
          }
          const response = await fetch("/api/boxing/fighters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names: chunk }),
          });
          const responseText = await response.text();
          let body: {
            fighters?: Array<{
              fighterName: string;
              wikipediaUrl?: string;
              profile?: FighterProfile;
              record?: WikipediaFighterRecord;
            }>;
            error?: string;
          };
          try {
            body = responseText
              ? (JSON.parse(responseText) as typeof body)
              : {};
          } catch {
            throw new Error(
              `Wikipediaの確認に失敗しました（HTTP ${response.status}）。`,
            );
          }
          if (!response.ok) {
            throw new Error(body.error ?? "Wikipediaの確認に失敗しました。");
          }
          if (cancelled) return;
          setFighterWikipediaUrls((current) => {
            const next = { ...current };
            for (const item of body.fighters ?? []) {
              next[normalizeFighterName(item.fighterName)] =
                item.wikipediaUrl ?? null;
            }
            return next;
          });
          setFighterProfilesById((current) => {
            const next = { ...current };
            for (const item of body.fighters ?? []) {
              if (item.profile) next[item.profile.fighterKey] = item.profile;
            }
            return next;
          });
          setFighterRecordsById((current) => {
            const next = { ...current };
            for (const item of body.fighters ?? []) {
              if (item.record) {
                next[normalizeFighterName(item.fighterName)] = item.record;
              }
            }
            return next;
          });
          onFighterDataChange?.(
            (body.fighters ?? []).flatMap((item) =>
              item.profile ? [item.profile] : [],
            ),
            Object.fromEntries(
              (body.fighters ?? []).flatMap((item) =>
                item.record
                  ? [[normalizeFighterName(item.fighterName), item.record]]
                  : [],
              ),
            ),
          );
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          setFighterWikipediaError(
            loadError instanceof Error
              ? loadError.message
              : "Wikipediaの確認に失敗しました。",
          );
        }
      } finally {
        names.forEach((name) =>
          wikipediaLookupInFlight.current.delete(normalizeFighterName(name)),
        );
        if (!cancelled) setFighterWikipediaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    fighterListView,
    fighterWikipediaFilter,
    wikipediaLookupCandidates,
    wikipediaLookupRequest,
    wikipediaLookupFilterKey,
    onFighterDataChange,
  ]);

  const requestWikipediaForFighterPage = useCallback(
    (fighters: ManagedFighter[]) => {
      setWikipediaLookupRequest({
        filterKey: wikipediaLookupFilterKey,
        fighters,
      });
    },
    [wikipediaLookupFilterKey],
  );

  const wikipediaRecord = useFighterRecord(
    fighterView ? selectedFighter : "",
  );
  // Wikipediaに戦績表があればそれを正本にし、無ければ収録データだけで組み立てる。
  const fighterRecord = useMemo(
    () =>
      buildFighterBouts(
        selectedFighter,
        boutsForTable(allBouts, "fighter", selectedFighter),
        wikipediaRecord.record,
      ),
    [allBouts, selectedFighter, wikipediaRecord.record],
  );
  const tableBouts = useMemo(
    () =>
      fighterView
        ? fighterRecord.bouts
        : fighterListView
          ? []
          : boutsForTable(filteredBouts, tableView, selectedFighter),
    [
      fighterRecord.bouts,
      fighterListView,
      fighterView,
      filteredBouts,
      selectedFighter,
      tableView,
    ],
  );
  const fighterStats = useMemo(
    () => summarizeFighterRecord(fighterRecord.bouts, selectedFighter),
    [fighterRecord.bouts, selectedFighter],
  );

  const changeTableView = (nextView: BoxingTableView) => {
    setTableView(nextView);
    setViewMode("table");
  };

  const changeViewMode = (nextMode: DataViewMode) => {
    if (nextMode === "cards" && cardScrollPosition.current !== null) {
      const position = cardScrollPosition.current;
      setViewMode(nextMode);
      cardScrollPosition.current = null;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, position);
        });
      });
      return;
    }
    setViewMode(nextMode);
  };

  const changeSelectedFighter = (
    value: string,
    options: { force?: boolean } = {},
  ) => {
    if (viewMode === "cards" && cardScrollPosition.current === null) {
      cardScrollPosition.current = window.scrollY;
    }
    setSelectedFighter(value);

    const normalizedValue = normalizeFighterName(value);
    const exactMatch = fighterOptions.find(
      (fighter) => normalizeFighterName(fighter) === normalizedValue,
    );
    // 入力途中の文字列で一覧を切り替えない。ただし一覧内の対戦相手リンクからは、
    // 収録データに無い選手でもWikipediaの戦績を見に行けるようにする。
    if (!exactMatch && !options.force) return;

    const nextFighter = exactMatch ?? value;
    if (
      tableView !== "fighter" ||
      selectedFighter !== nextFighter ||
      viewMode !== "table"
    ) {
      navigationHistory.current.push({
        viewMode,
        tableView,
        selectedFighter,
      });
    }
    setSelectedFighter(exactMatch ?? value);
    setTableView("fighter");
    setViewMode("table");
    window.requestAnimationFrame(() => {
      document.getElementById("boxing-data-view")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const goBack = () => {
    const previous = navigationHistory.current.pop();
    if (!previous) {
      setSelectedFighter("");
      setTableView("fighters");
      setViewMode("table");
      return;
    }

    setSelectedFighter(previous.selectedFighter);
    setTableView(previous.tableView);
    setViewMode(previous.viewMode);
    if (previous.viewMode === "cards" && cardScrollPosition.current !== null) {
      const position = cardScrollPosition.current;
      cardScrollPosition.current = null;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, position);
        });
      });
    }
  };

  const stats: Stat[] = useMemo(() => {
    const upcomingEvents = filtered.filter(isEventUpcoming).length;
    const finishedEvents = filtered.length - upcomingEvents;
    const domesticEvents = filtered.filter((event) => event.domestic).length;
    return [
      { label: "興行数", value: filtered.length, hint: "条件に一致" },
      {
        label: "開催予定",
        value: upcomingEvents,
        accent: "text-amber-300",
        hint: "これからの興行",
      },
      {
        label: "開催済み",
        value: finishedEvents,
        accent: "text-emerald-300",
        hint: "主要シリーズ全履歴",
      },
      {
        label: "国内開催",
        value: domesticEvents,
        accent: "text-sky-300",
        hint: "日本国内",
      },
    ];
  }, [filtered]);

  const updatedLabel = formatUpdatedAt(updatedAt);

  return (
    <div className="space-y-4">
      <section className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold text-gray-500">
            スポーツイベント
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            ボクシング興行
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-400">
            興行を一つのボードとして確認。シリーズ、開催状態、会場と対戦カードをまとめています。
          </p>
          <Link
            href="/world-titles"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200"
          >
            <Trophy className="h-3 w-3" />
            世界戦一覧
          </Link>
        </div>
        <div
          className={`shrink-0 rounded-md border px-2 py-1 text-right text-[10px] font-semibold ${
            "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
          }`}
          title={sourceName}
        >
          <span className="flex items-center justify-end gap-1">
            <Database className="h-3 w-3" />
            ボクモバ + JBC
          </span>
          {updatedLabel && (
            <span className="mt-0.5 block font-normal opacity-70">
              更新 {updatedLabel}
            </span>
          )}
        </div>
      </section>

      {warning && (
        <div className="rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          {warning}
        </div>
      )}

      <StatCards stats={stats} />

      <EventFilterBar
        filters={filters}
        onChange={setFilters}
        series={eventSeries}
        checkedOnly={checkedOnly}
        checkedCount={checkedEventCount}
        onCheckedOnlyChange={setCheckedOnly}
      />

      <DataViewToolbar
        id="boxing-data-view"
        mode={viewMode}
        onModeChange={changeViewMode}
        count={
          viewMode === "cards" || tableView === "events"
            ? filtered.length
            : fighterListView
              ? filteredFighters.length
              : tableBouts.length
        }
        unit={
          viewMode === "table" && fighterListView
            ? "選手"
            : viewMode === "table" && tableView !== "events"
              ? "試合"
              : "興行"
        }
      >
        <label className="flex min-w-0 items-center gap-1.5 text-[10px] text-gray-500">
          <span className="shrink-0 font-semibold text-gray-400">
            選手別結果・予定
          </span>
          <EntityPicker
            id="boxing-fighter-options"
            value={selectedFighter}
            onChange={changeSelectedFighter}
            options={fighterOptions}
            placeholder="選手名を入力・選択…"
            ariaLabel="選手別の試合結果と予定を表示"
            accentClassName="focus:border-red-400/60"
          />
        </label>
        {viewMode === "table" && (
          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="一覧の種類"
          >
            {TABLE_VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => changeTableView(option.value)}
                aria-pressed={tableView === option.value}
                className={`h-7 rounded-md border px-2 text-[11px] font-semibold transition-colors ${
                  tableView === option.value
                    ? "border-red-400/40 bg-red-400/10 text-red-100"
                    : "border-white/10 bg-[#101018] text-gray-500 hover:border-white/20 hover:text-gray-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </DataViewToolbar>

      {viewMode === "table" && fighterListView && (
        <section className="glass-card space-y-2 rounded-lg px-3 py-2.5">
          <div className="text-[11px] font-semibold text-gray-400">階級</div>
          <div
            className="flex flex-wrap gap-1.5"
            role="radiogroup"
            aria-label="選手一覧を階級で絞り込み"
          >
            {["all", ...fighterWeightClasses].map((weightClass) => {
              const active = fighterWeightClass === weightClass;
              return (
                <button
                  key={weightClass}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFighterWeightClass(weightClass)}
                  className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                    active
                      ? "border-red-400/40 bg-red-400/10 font-semibold text-red-100"
                      : "border-white/10 bg-[#101018] text-gray-500 hover:border-white/20 hover:text-gray-200"
                  }`}
                >
                  {weightClass === "all" ? "すべて" : weightClass}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-white/5 pt-2">
            <label className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="font-semibold">選手名</span>
              <input
                type="search"
                value={fighterNameQuery}
                onChange={(event) => setFighterNameQuery(event.target.value)}
                placeholder="部分一致"
                aria-label="選手名で絞り込み"
                className="h-7 w-36 rounded-md border border-white/10 bg-[#101018] px-2 text-[11px] text-gray-200 outline-none placeholder:text-gray-600 focus:border-red-400/60"
              />
            </label>
            <label className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="font-semibold">所属</span>
              <select
                value={fighterAffiliation}
                onChange={(event) => setFighterAffiliation(event.target.value)}
                aria-label="選手一覧を所属で絞り込み"
                className="h-7 max-w-56 rounded-md border border-white/10 bg-[#101018] px-2 text-[11px] text-gray-200 outline-none focus:border-red-400/60"
              >
                <option value="all">すべて</option>
                {fighterAffiliations.map((affiliation) => (
                  <option key={affiliation.name} value={affiliation.name}>
                    {affiliation.name}（{affiliation.count.toLocaleString("ja-JP")}人）
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="font-semibold">国籍</span>
              <select
                value={fighterCountry}
                onChange={(event) => setFighterCountry(event.target.value)}
                aria-label="選手一覧を国籍で絞り込み"
                className="h-7 max-w-48 rounded-md border border-white/10 bg-[#101018] px-2 text-[11px] text-gray-200 outline-none focus:border-red-400/60"
              >
                <option value="all">すべて</option>
                {fighterCountries.map((country) => (
                  <option key={country.name} value={country.name}>
                    {country.name}（{country.count.toLocaleString("ja-JP")}人）
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="font-semibold">Wikipedia</span>
              <select
                value={fighterWikipediaFilter}
                onChange={(event) =>
                  setFighterWikipediaFilter(
                    event.target.value as FighterWikipediaFilter,
                  )
                }
                aria-label="選手一覧をWikipediaページの有無で絞り込み"
                className="h-7 rounded-md border border-white/10 bg-[#101018] px-2 text-[11px] text-gray-200 outline-none focus:border-red-400/60"
              >
                <option value="all">すべて</option>
                <option value="has">
                  あり（{fighterWikipediaOptionCounts.has.toLocaleString("ja-JP")}人）
                </option>
                <option value="none">
                  なし（{fighterWikipediaOptionCounts.none.toLocaleString("ja-JP")}人）
                </option>
                <option value="unknown">
                  未確認（{fighterWikipediaOptionCounts.unknown.toLocaleString("ja-JP")}人）
                </option>
              </select>
            </label>
            {(fighterWeightClass !== "all" ||
              fighterAffiliation !== "all" ||
              fighterCountry !== "all" ||
              fighterWikipediaFilter !== "all" ||
              fighterNameQuery !== "") && (
              <button
                type="button"
                onClick={() => {
                  setFighterWeightClass("all");
                  setFighterAffiliation("all");
                  setFighterCountry("all");
                  setFighterWikipediaFilter("all");
                  setFighterNameQuery("");
                }}
                className="h-7 rounded-md border border-white/10 px-2 text-[11px] text-gray-400 hover:border-white/20 hover:text-white"
              >
                選手フィルタをリセット
              </button>
            )}
          </div>
          {fighterWikipediaLoading && (
            <p className="text-[10px] text-sky-300/70">
              Wikipediaページの有無を確認中…
            </p>
          )}
          {fighterWikipediaError && (
            <p className="text-[10px] text-amber-300/80">
              {fighterWikipediaError}
            </p>
          )}
          <p className="text-[10px] text-gray-600">
            アプリに収録している全対戦カードから選手と戦績を集約しています。上の興行フィルタはこの一覧には適用されません。
          </p>
        </section>
      )}

      {viewMode === "table" && fighterView && !selectedFighter && fighterMatches.length > 0 && (
        <section className="glass-card flex flex-wrap items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-gray-400">
          <span className="mr-1">「{filters.query}」に一致する選手を選択：</span>
          {fighterMatches.map((fighter) => (
            <button
              key={fighter}
              type="button"
              onClick={() => {
                changeSelectedFighter(fighter);
                setFilters((current) => ({ ...current, query: "" }));
              }}
              className="rounded-md border border-red-400/30 bg-red-400/10 px-2 py-1 text-[11px] text-red-200 hover:border-red-300/60 hover:text-white"
            >
              {fighter}
            </button>
          ))}
        </section>
      )}

      {filtered.length === 0 &&
      !(viewMode === "table" && (fighterView || fighterListView)) ? (
        <div className="glass-card flex flex-col items-center gap-2 rounded-lg py-10 text-center text-gray-400">
          <CalendarClock className="h-6 w-6 text-gray-600" />
          <p>条件に一致する興行がありません。</p>
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_EVENT_FILTERS);
              setCheckedOnly(false);
            }}
            className="mt-1 rounded-md border border-white/10 px-2.5 py-1 text-xs text-gray-300 hover:border-white/20 hover:text-white"
          >
            フィルタをリセット
          </button>
        </div>
      ) : viewMode === "table" ? (
        <>
          {fighterView && selectedFighter && (
            <>
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-[#101018] px-2.5 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                前の画面に戻る
              </button>
              <FighterRecordSummary
                fighter={selectedFighter}
                stats={fighterStats}
                source={fighterRecord.source}
                status={wikipediaRecord.status}
                record={wikipediaRecord.record}
              />
              <div className="rounded-md border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-xs text-amber-100/80">
                {selectedFighter}の過去の試合結果と今後の試合予定を同じ表に表示しています。上の興行フィルタはこの一覧には適用されません。
              </div>
            </>
          )}
          <BoxingDataTable
            view={tableView}
            events={filtered}
            bouts={tableBouts}
            fighters={displayFighters}
            fighterProfiles={fighterProfilesById}
            wikipediaUrls={fighterWikipediaUrls}
            selectedFighter={selectedFighter}
            onSelectFighter={(fighter) =>
              changeSelectedFighter(fighter, { force: true })
            }
            onFighterPageChange={requestWikipediaForFighterPage}
          />
        </>
      ) : (
        <div className="responsive-card-grid">
          {filtered.map((event) => (
            <div key={event.id} className="min-w-0">
              <EventCard
                event={event}
                checked={isChecked(event)}
                onToggleCheck={() => toggleCheckedEvent(event)}
                onSelectFighter={changeSelectedFighter}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
