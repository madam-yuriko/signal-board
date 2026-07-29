"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Trophy } from "lucide-react";
import { events } from "@/data/events";
import {
  availableSeries,
  EMPTY_EVENT_FILTERS,
  filterPromotionEvents,
  type EventFilters,
} from "@/lib/filters";
import { isUpcoming } from "@/lib/format";
import EventFilterBar from "@/components/EventFilterBar";
import EventCard from "@/components/EventCard";
import StatCards, { type Stat } from "@/components/StatCards";

export default function DashboardPage() {
  const [filters, setFilters] =
    useState<EventFilters>(EMPTY_EVENT_FILTERS);

  const eventSeries = useMemo(() => availableSeries(events), []);
  const filtered = useMemo(
    () => filterPromotionEvents(events, filters),
    [filters],
  );

  const stats: Stat[] = useMemo(() => {
    const upcomingEvents = filtered.filter((event) =>
      isUpcoming(event.date),
    ).length;
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
        hint: "結果を収録",
      },
      {
        label: "国内開催",
        value: domesticEvents,
        accent: "text-sky-300",
        hint: "日本国内",
      },
    ];
  }, [filtered]);

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
            {"\u4e16\u754c\u6226\u4e00\u89a7"}
          </Link>
        </div>
        <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-400">
          モックデータ
        </span>
      </section>

      <StatCards stats={stats} />

      <EventFilterBar
        filters={filters}
        onChange={setFilters}
        series={eventSeries}
      />

      {filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-2 rounded-lg py-10 text-center text-gray-400">
          <CalendarClock className="h-6 w-6 text-gray-600" />
          <p>条件に一致する興行がありません。</p>
          <button
            type="button"
            onClick={() => setFilters(EMPTY_EVENT_FILTERS)}
            className="mt-1 rounded-md border border-white/10 px-2.5 py-1 text-xs text-gray-300 hover:border-white/20 hover:text-white"
          >
            フィルタをリセット
          </button>
        </div>
      ) : (
        <div className="gap-3 [column-fill:_balance] columns-1 sm:columns-2 xl:columns-3">
          {filtered.map((event) => (
            <div key={event.id} className="mb-3 break-inside-avoid">
              <EventCard event={event} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}