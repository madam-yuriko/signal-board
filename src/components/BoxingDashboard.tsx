"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Database, Trophy } from "lucide-react";
import type { BoxingEvent } from "@/types";
import {
  availableSeries,
  EMPTY_EVENT_FILTERS,
  filterPromotionEvents,
  type EventFilters,
} from "@/lib/filters";
import { isEventUpcoming } from "@/lib/format";
import EventFilterBar from "@/components/EventFilterBar";
import EventCard from "@/components/EventCard";
import StatCards, { type Stat } from "@/components/StatCards";

interface Props {
  events: BoxingEvent[];
  feedMode: "live" | "fallback";
  sourceName: string;
  updatedAt?: string;
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
  feedMode,
  sourceName,
  updatedAt,
}: Props) {
  const [filters, setFilters] =
    useState<EventFilters>(EMPTY_EVENT_FILTERS);

  const eventSeries = useMemo(() => availableSeries(events), [events]);
  const filtered = useMemo(
    () => filterPromotionEvents(events, filters),
    [events, filters],
  );

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
        hint: "直近180日",
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
            feedMode === "live"
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
              : "border-amber-400/20 bg-amber-400/10 text-amber-300"
          }`}
          title={sourceName}
        >
          <span className="flex items-center justify-end gap-1">
            <Database className="h-3 w-3" />
            {feedMode === "live" ? "JBC 実データ" : "保存データ"}
          </span>
          {updatedLabel && (
            <span className="mt-0.5 block font-normal opacity-70">
              更新 {updatedLabel}
            </span>
          )}
        </div>
      </section>

      {feedMode === "fallback" && (
        <div className="rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          JBCに接続できないため、保存済みデータを表示しています。
        </div>
      )}

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
