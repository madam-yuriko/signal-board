"use client";

import { ExternalLink } from "lucide-react";
import type {
  FighterRecordSource,
  FighterRecordStats,
  WikipediaFighterRecord,
} from "@/lib/fighterRecord";
import type { FighterRecordStatus } from "@/hooks/useFighterRecord";

interface Props {
  fighter: string;
  stats: FighterRecordStats;
  source: FighterRecordSource;
  status: FighterRecordStatus;
  record?: WikipediaFighterRecord;
}

interface Chip {
  label: string;
  value: number;
  accent: string;
  /** 0件でも常に表示するか */
  always?: boolean;
}

function chips(stats: FighterRecordStats): Chip[] {
  return [
    { label: "勝", value: stats.win, accent: "text-emerald-300", always: true },
    { label: "KO勝ち", value: stats.ko, accent: "text-emerald-200", always: true },
    { label: "敗", value: stats.loss, accent: "text-rose-300", always: true },
    { label: "分", value: stats.draw, accent: "text-slate-300", always: true },
    { label: "無効", value: stats.noContest, accent: "text-slate-300" },
    { label: "予定", value: stats.scheduled, accent: "text-amber-300" },
    { label: "結果未取得", value: stats.unknown, accent: "text-gray-400" },
  ];
}

export default function FighterRecordSummary({
  fighter,
  stats,
  source,
  status,
  record,
}: Props) {
  const visibleChips = chips(stats).filter(
    (chip) => chip.always || chip.value > 0,
  );

  return (
    <section className="glass-card rounded-lg px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-gray-500">通算戦績</div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-lg font-bold text-white">{fighter}</span>
            <span className="text-sm font-semibold tabular-nums text-gray-200">
              {stats.total}戦 {stats.win}勝（{stats.ko}KO）{stats.loss}敗{" "}
              {stats.draw}分
              {stats.noContest > 0 ? ` ${stats.noContest}無効` : ""}
            </span>
          </div>
        </div>

        {status === "loading" ? (
          <span className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] text-gray-500">
            Wikipediaを確認中…
          </span>
        ) : source === "wikipedia" && record ? (
          <a
            href={record.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-sky-400/25 bg-sky-400/10 px-2 py-1 text-[10px] font-semibold text-sky-200 hover:border-sky-300/50 hover:text-white"
            title={`Wikipedia「${record.pageTitle}」の戦績表`}
          >
            <ExternalLink className="h-3 w-3" />
            Wikipedia 戦績
          </a>
        ) : (
          <span
            className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-400"
            title="Wikipediaに戦績表が見つからないため、本アプリが収録している興行の試合だけを表示しています。"
          >
            本アプリ収録分のみ
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {visibleChips.map((chip) => (
          <span
            key={chip.label}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400"
          >
            {chip.label}
            <span className={`font-bold tabular-nums ${chip.accent}`}>
              {chip.value}
            </span>
          </span>
        ))}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
        {source === "wikipedia"
          ? "Wikipediaの戦績表を正本にし、本アプリが収録している興行の会場・階級で補完しています。Wikipediaに未反映の今後の試合予定は収録データから追加しています。"
          : "Wikipediaに戦績表が無いため、本アプリが収録している興行の試合だけを集計しています。全試合ではありません。"}
      </p>
    </section>
  );
}
