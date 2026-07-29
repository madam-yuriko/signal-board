"use client";

import { Search, X } from "lucide-react";
import type { BoutResult, Organization } from "@/types";
import { ORGANIZATIONS } from "@/types";
import { RESULT_LABEL } from "@/lib/format";
import {
  activeFilterCount,
  EMPTY_FILTERS,
  type Filters,
} from "@/lib/filters";

const RESULT_OPTIONS: BoutResult[] = ["win", "loss", "draw", "scheduled"];

const STATUS_OPTIONS: { value: Filters["status"]; label: string }[] = [
  { value: "all", label: "全て" },
  { value: "scheduled", label: "予定" },
  { value: "finished", label: "開催済み" },
];

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  eventSeries?: string[];
  weightClasses: string[];
  /** 「国内のみ」トグルを表示するか */
  showDomesticToggle?: boolean;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
        active
          ? "border-red-500/50 bg-red-500/20 text-red-200"
          : "border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}

export default function FilterBar({
  filters,
  onChange,
  eventSeries = [],
  weightClasses,
  showDomesticToggle = true,
}: Props) {
  const count = activeFilterCount(filters);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  return (
    <div className="glass-card space-y-3 rounded-lg p-3">
      {/* 検索 + リセット */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="興行名・シリーズ・会場・選手名で検索"
            className="w-full rounded-md border border-white/10 bg-black/30 py-1.5 pl-8 pr-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-red-500/50"
          />
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-gray-400 hover:border-white/20 hover:text-white"
          >
            <X className="h-3 w-3" />
            リセット ({count})
          </button>
        )}
      </div>

      {eventSeries.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            興行シリーズ
          </div>
          <div className="flex flex-wrap gap-1">
            {eventSeries.map((series) => (
              <Chip
                key={series}
                active={filters.series.includes(series)}
                onClick={() =>
                  onChange({
                    ...filters,
                    series: toggle(filters.series, series),
                  })
                }
              >
                {series}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* 状態 */}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            状態
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_OPTIONS.map((s) => (
              <Chip
                key={s.value}
                active={filters.status === s.value}
                onClick={() => onChange({ ...filters, status: s.value })}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* 団体 */}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            団体
          </div>
          <div className="flex flex-wrap gap-1">
            {ORGANIZATIONS.map((org: Organization) => (
              <Chip
                key={org}
                active={filters.organizations.includes(org)}
                onClick={() =>
                  onChange({
                    ...filters,
                    organizations: toggle(filters.organizations, org),
                  })
                }
              >
                {org}
              </Chip>
            ))}
          </div>
        </div>

        {/* 結果 */}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            結果（日本側）
          </div>
          <div className="flex flex-wrap gap-1">
            {RESULT_OPTIONS.map((r) => (
              <Chip
                key={r}
                active={filters.results.includes(r)}
                onClick={() =>
                  onChange({ ...filters, results: toggle(filters.results, r) })
                }
              >
                {RESULT_LABEL[r]}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* 階級 */}
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          階級
        </div>
        <div className="flex flex-wrap gap-1">
          {weightClasses.map((wc) => (
            <Chip
              key={wc}
              active={filters.weightClasses.includes(wc)}
              onClick={() =>
                onChange({
                  ...filters,
                  weightClasses: toggle(filters.weightClasses, wc),
                })
              }
            >
              {wc}
            </Chip>
          ))}
        </div>
      </div>

      {showDomesticToggle && (
        <label className="flex w-fit cursor-pointer items-center gap-1.5 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={filters.domesticOnly}
            onChange={(e) =>
              onChange({ ...filters, domesticOnly: e.target.checked })
            }
            className="h-3.5 w-3.5 accent-red-500"
          />
          国内開催のみ表示
        </label>
      )}
    </div>
  );
}
