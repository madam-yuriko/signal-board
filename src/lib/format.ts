import type { BoutResult, BoxingEvent, Organization } from "@/types";

/** 団体ごとのバッジ配色 */
export const ORG_STYLES: Record<Organization, string> = {
  WBA: "bg-red-500/15 text-red-300 border-red-500/30",
  WBC: "bg-green-600/15 text-green-300 border-green-600/30",
  IBF: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  WBO: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

/** 日本側選手から見た結果ラベル */
export const RESULT_LABEL: Record<BoutResult, string> = {
  win: "勝利",
  loss: "敗北",
  draw: "引分",
  scheduled: "予定",
};

/** 結果バッジの配色 */
export const RESULT_STYLES: Record<BoutResult, string> = {
  win: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  loss: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  draw: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  scheduled: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "2026-06-06" -> "2026年6月6日(土)" */
export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${
    WEEKDAYS[d.getDay()]
  })`;
}

/** "2026-06-06" -> "6/6" */
export function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 今日（ローカル0時）以降の日付かどうか */
export function isUpcoming(iso: string): boolean {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

/** Prefer the source status; use the date only for legacy events. */
export function isEventUpcoming(
  event: Pick<BoxingEvent, "date" | "status">,
): boolean {
  return event.status
    ? event.status === "scheduled"
    : isUpcoming(event.date);
}

/** 軽い階級順（軽い→重い）。並べ替え用。 */
export const WEIGHT_ORDER: string[] = [
  "ミニマム級",
  "ライトフライ級",
  "フライ級",
  "スーパーフライ級",
  "バンタム級",
  "スーパーバンタム級",
  "フェザー級",
  "スーパーフェザー級",
  "ライト級",
  "スーパーライト級",
  "ウェルター級",
  "スーパーウェルター級",
  "ミドル級",
  "女子アトム級",
  "女子スーパーフライ級",
];

export function weightRank(weightClass: string): number {
  const i = WEIGHT_ORDER.indexOf(weightClass);
  return i === -1 ? WEIGHT_ORDER.length : i;
}
