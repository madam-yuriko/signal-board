"use client";

import { LayoutGrid, Table2 } from "lucide-react";

export type DataViewMode = "cards" | "table";

interface Props {
  id?: string;
  mode: DataViewMode;
  onModeChange: (mode: DataViewMode) => void;
  count: number;
  unit?: string;
  children?: React.ReactNode;
}

export default function DataViewToolbar({
  id,
  mode,
  onModeChange,
  count,
  unit = "件",
  children,
}: Props) {
  return (
    <section id={id} className="glass-card flex flex-col gap-2 rounded-lg p-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div
        className="inline-flex w-fit rounded-md border border-white/10 bg-black/20 p-0.5"
        role="group"
        aria-label="表示形式"
      >
        <button
          type="button"
          onClick={() => onModeChange("cards")}
          aria-pressed={mode === "cards"}
          className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[11px] font-semibold transition-colors ${
            mode === "cards"
              ? "bg-white/10 text-white shadow-sm"
              : "text-gray-500 hover:text-gray-200"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          カード
        </button>
        <button
          type="button"
          onClick={() => onModeChange("table")}
          aria-pressed={mode === "table"}
          className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[11px] font-semibold transition-colors ${
            mode === "table"
              ? "bg-white/10 text-white shadow-sm"
              : "text-gray-500 hover:text-gray-200"
          }`}
        >
          <Table2 className="h-3.5 w-3.5" />
          一覧
        </button>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {children}
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-gray-500 sm:ml-0">
          {count.toLocaleString("ja-JP")}{unit}
        </span>
      </div>
    </section>
  );
}
