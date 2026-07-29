"use client";

import { useMemo, useState } from "react";
import { Calendar, MapPin, Trophy, Search as SearchIcon } from "lucide-react";
import { events } from "@/data/events";
import { champions } from "@/data/champions";
import {
  availableSeries,
  availableWeightClasses,
  EMPTY_FILTERS,
  filterBouts,
  flattenBouts,
  type Filters,
} from "@/lib/filters";
import { formatShortDate } from "@/lib/format";
import FilterBar from "@/components/FilterBar";
import BoutRow from "@/components/BoutRow";
import ChampionsTable from "@/components/ChampionsTable";
import StatCards, { type Stat } from "@/components/StatCards";

export default function WorldTitlesPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const allBouts = useMemo(() => flattenBouts(events), []);
  const weightClasses = useMemo(() => availableWeightClasses(events), []);
  const eventSeries = useMemo(() => availableSeries(events), []);
  const filtered = useMemo(
    () => filterBouts(allBouts, filters),
    [allBouts, filters],
  );

  const stats: Stat[] = useMemo(() => {
    const wins = filtered.filter((b) => b.result === "win").length;
    const losses = filtered.filter((b) => b.result === "loss").length;
    return [
      { label: "収録 世界戦", value: filtered.length, hint: "条件に一致" },
      {
        label: "現役日本人王者",
        value: champions.length,
        accent: "text-amber-300",
        hint: "主要4団体",
      },
      { label: "勝利", value: wins, accent: "text-emerald-300" },
      { label: "敗北", value: losses, accent: "text-rose-300" },
    ];
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* 現役王者 */}
      <section className="space-y-2.5">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-bold tracking-tight sm:text-2xl">
            <Trophy className="h-5 w-5 text-amber-400" />
            世界戦一覧
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            日本ジム所属選手が関わる世界タイトルマッチの記録と予定。まずは現役の日本人世界王者から。
          </p>
        </div>
        <ChampionsTable champions={champions} />
      </section>

      {/* タイトルマッチ一覧 */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">タイトルマッチ記録・予定</h2>

        <StatCards stats={stats} />

        <FilterBar
          filters={filters}
          onChange={setFilters}
          eventSeries={eventSeries}
          weightClasses={weightClasses}
        />

        {filtered.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 rounded-lg py-10 text-center text-gray-400">
            <SearchIcon className="h-6 w-6 text-gray-600" />
            <p>条件に一致する試合がありません。</p>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="mt-1 rounded-md border border-white/10 px-2.5 py-1 text-xs text-gray-300 hover:border-white/20 hover:text-white"
            >
              フィルタをリセット
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((bout) => (
              <div key={bout.id} className="glass-card rounded-lg p-2.5">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1 font-semibold text-gray-300">
                    <Calendar className="h-3 w-3" />
                    {formatShortDate(bout.event.date)}
                    <span className="text-gray-500">
                      ({bout.event.date.slice(0, 4)})
                    </span>
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {bout.event.venue}・{bout.event.city}
                  </span>
                </div>
                <BoutRow bout={bout} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
