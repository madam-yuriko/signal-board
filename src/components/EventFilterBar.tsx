"use client";

import { RotateCcw, Search } from "lucide-react";
import {
  activeEventFilterCount,
  EMPTY_EVENT_FILTERS,
  type EventFilters,
} from "@/lib/filters";

const STATUS_OPTIONS: {
  value: EventFilters["status"];
  label: string;
}[] = [
  { value: "all", label: "すべて" },
  { value: "scheduled", label: "開催予定" },
  { value: "finished", label: "開催済み" },
];

interface Props {
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
  series: string[];
}

export default function EventFilterBar({
  filters,
  onChange,
  series,
}: Props) {
  const filterCount = activeEventFilterCount(filters);

  function selectSeries(value?: string) {
    onChange({
      ...filters,
      series: value ? [value] : [],
    });
  }

  return (
    <section className="glass-card space-y-3 rounded-lg p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            value={filters.query}
            onChange={(event) =>
              onChange({ ...filters, query: event.target.value })
            }
            placeholder="興行名・シリーズ・会場で検索"
            className="w-full rounded-md border border-white/10 bg-black/30 py-2 pl-8 pr-3 text-xs text-white outline-none placeholder:text-gray-600 focus:border-red-400/60"
          />
        </div>
        {filterCount > 0 && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_EVENT_FILTERS)}
            title="フィルタをリセット"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs text-gray-400 hover:border-white/20 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            リセット
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[10px] font-semibold text-gray-500">
            興行シリーズ
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              aria-pressed={filters.series.length === 0}
              onClick={() => selectSeries()}
              className={`rounded-md border px-2 py-1 text-[11px] ${
                filters.series.length === 0
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/8 text-gray-500 hover:text-gray-300"
              }`}
            >
              すべて
            </button>
            {series.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filters.series.includes(item)}
                onClick={() => selectSeries(item)}
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  filters.series.includes(item)
                    ? "border-red-400/40 bg-red-400/10 text-red-200"
                    : "border-white/8 text-gray-500 hover:text-gray-300"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[10px] font-semibold text-gray-500">
            状態
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filters.status === option.value}
                onClick={() =>
                  onChange({ ...filters, status: option.value })
                }
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  filters.status === option.value
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-white/8 text-gray-500 hover:text-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={filters.domesticOnly}
              onClick={() =>
                onChange({
                  ...filters,
                  domesticOnly: !filters.domesticOnly,
                })
              }
              className={`rounded-md border px-2 py-1 text-[11px] ${
                filters.domesticOnly
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/8 text-gray-500 hover:text-gray-300"
              }`}
            >
              国内開催のみ
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
