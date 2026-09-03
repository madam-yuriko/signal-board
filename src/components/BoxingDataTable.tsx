"use client";

import type { BoutResult, BoxingEvent } from "@/types";
import type { BoutWithEvent } from "@/lib/filters";
import { formatShortDate, isEventUpcoming } from "@/lib/format";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import BoutTitleBadges from "@/components/BoutTitleBadges";
import { isWorldTitle, titlesForBout } from "@/lib/boutTitles";
import {
  fighterAnnotation,
  fighterInfo,
  isSelectableFighter,
  normalizeFighterName,
  sameFighterName,
} from "@/lib/fighterInfo";
import { fighterBoutResult } from "@/lib/fighterRecord";

export type BoxingTableView = "events" | "bouts" | "world" | "fighter";
type TableBoutResult = BoutResult | "unknown";

export function availableFighters(bouts: BoutWithEvent[]): string[] {
  const names = new Map<string, string>();
  for (const name of bouts.flatMap((bout) => [bout.jpFighter, bout.opponent])) {
    if (!name) continue;
    const key = name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (!names.has(key)) names.set(key, name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, "ja"));
}

export function isWorldTitleBout(bout: BoutWithEvent): boolean {
  return isWorldTitle(bout);
}

export function boutsForTable(
  bouts: BoutWithEvent[],
  view: BoxingTableView,
  fighter: string,
): BoutWithEvent[] {
  if (view === "world") {
    return bouts.filter(isWorldTitleBout);
  }
  if (view === "fighter") {
    if (!fighter) return [];
    const matched = bouts.filter(
          (bout) => sameFighterName(bout.jpFighter, fighter) || sameFighterName(bout.opponent, fighter),
        );
    const unique = new Map<string, BoutWithEvent>();
    for (const bout of matched) {
      const pair = [
        normalizeFighterName(bout.jpFighter),
        normalizeFighterName(bout.opponent),
      ].sort().join(":");
      const key = `${bout.event.date}:${pair}`;
      const existing = unique.get(key);
      if (
        !existing ||
        (existing.result === "scheduled" && bout.result !== "scheduled") ||
        (!existing.method && Boolean(bout.method))
      ) {
        unique.set(key, bout);
      }
    }
    return [...unique.values()];
  }
  return bouts;
}

function tableResult(bout: BoutWithEvent, fighter?: string): TableBoutResult {
  const result = fighter ? fighterBoutResult(bout, fighter) : bout.result;
  return result === "scheduled" && !isEventUpcoming(bout.event)
    ? "unknown"
    : result;
}

function resultBadge(result: TableBoutResult) {
  const styles: Record<TableBoutResult, string> = {
    win: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    loss: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    draw: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    scheduled: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    "no-contest": "border-slate-400/30 bg-slate-400/10 text-slate-300",
    cancelled: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    unknown: "border-slate-400/20 bg-slate-400/5 text-slate-400",
  };
  const labels: Record<TableBoutResult, string> = {
    win: "勝",
    loss: "敗",
    draw: "引分",
    scheduled: "予定",
    "no-contest": "無効",
    cancelled: "中止",
    unknown: "結果未取得",
  };
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold ${styles[result]}`}>
      {labels[result]}
    </span>
  );
}

function boutOutcome(bout: BoutWithEvent) {
  const result = tableResult(bout);
  if (result === "win" || result === "loss") {
    const winner = result === "win" ? bout.jpFighter : bout.opponent;
    return (
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        {resultBadge("win")}
        <span className="font-semibold text-gray-200">{winner}</span>
      </div>
    );
  }
  return resultBadge(result);
}

function japaneseOutcome(bout: BoutWithEvent): TableBoutResult | undefined {
  const leftInfo = fighterInfo(bout.jpFighter, {
    country: bout.jpFighterCountry,
    gym: bout.jpFighterGym,
  });
  const rightInfo = fighterInfo(bout.opponent, {
    country: bout.opponentCountry,
    gym: bout.opponentGym,
  });
  const leftIsForeign = Boolean(leftInfo.country);
  const rightIsForeign = Boolean(rightInfo.country);

  // 国籍が同じ側同士の試合は、日本人の勝敗として表示しない。
  if (leftIsForeign === rightIsForeign) return undefined;

  const result = tableResult(bout);
  if (result !== "win" && result !== "loss") return result;
  const japaneseIsLeft = !leftIsForeign;
  return japaneseIsLeft === (result === "win") ? "win" : "loss";
}

function japaneseResultBadge(bout: BoutWithEvent) {
  const result = japaneseOutcome(bout);
  return result ? resultBadge(result) : null;
}

function fighterLabel(
  name: string,
  info: { country?: string; gym?: string } = {},
) {
  const annotation = fighterAnnotation(name, info);
  return (
    <>
      {name}
      {annotation && (
        <span className="ml-1 text-[10px] text-gray-500">
          ({annotation})
        </span>
      )}
    </>
  );
}

/** 選手名から、その選手の結果・予定一覧へ切り替えられるようにする。 */
function fighterNameCell(
  name: string,
  info: { country?: string; gym?: string },
  onSelectFighter: (fighter: string) => void,
  className: string,
) {
  const label = fighterLabel(name, info);
  if (!isSelectableFighter(name)) {
    return <span className={className}>{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onSelectFighter(name)}
      className={`${className} cursor-pointer text-left underline decoration-white/20 underline-offset-2 transition-colors hover:text-red-200 hover:decoration-red-300/60`}
      aria-label={`${name}の選手別結果を表示`}
    >
      {label}
    </button>
  );
}

function eventColumns(): DataTableColumn<BoxingEvent>[] {
  return [
    {
      id: "date",
      label: "開催日",
      render: (event) => formatShortDate(event.date),
      sortValue: (event) => event.date,
      primary: true,
      className: "whitespace-nowrap",
    },
    {
      id: "name",
      label: "興行",
      render: (event) => event.name,
      sortValue: (event) => event.name,
      className: "min-w-52 font-semibold text-white",
    },
    {
      id: "status",
      label: "状態",
      render: (event) =>
        isEventUpcoming(event) ? (
          <span className="text-amber-300">開催予定</span>
        ) : (
          <span className="text-emerald-300">開催済み</span>
        ),
      sortValue: (event) => (isEventUpcoming(event) ? 1 : 0),
    },
    {
      id: "series",
      label: "シリーズ",
      render: (event) => event.series ?? "—",
      sortValue: (event) => event.series,
      hideOnMobile: true,
    },
    {
      id: "venue",
      label: "会場",
      render: (event) => (
        <div>
          <div>{event.venue}</div>
          <div className="mt-0.5 text-[10px] text-gray-600">{event.city}</div>
        </div>
      ),
      sortValue: (event) => `${event.city} ${event.venue}`,
      hideOnMobile: true,
      className: "min-w-40",
    },
    {
      id: "bouts",
      label: "収録試合",
      render: (event) => `${event.bouts.length}試合`,
      sortValue: (event) => event.bouts.length,
      align: "right",
    },
    {
      id: "broadcaster",
      label: "放送・配信",
      render: (event) => event.broadcaster ?? "—",
      sortValue: (event) => event.broadcaster,
      hideOnMobile: true,
    },
  ];
}

function boutColumns(
  view: BoxingTableView,
  selectedFighter: string,
  onSelectFighter: (fighter: string) => void,
): DataTableColumn<BoutWithEvent>[] {
  const fighterView = view === "fighter";
  return [
    {
      id: "date",
      label: "試合日",
      render: (bout) => formatShortDate(bout.event.date),
      sortValue: (bout) => bout.event.date,
      primary: true,
      className: "whitespace-nowrap",
    },
    fighterView
      ? {
          id: "opponent",
          label: "対戦相手",
          render: (bout) => {
            const selectedIsJapaneseSide = sameFighterName(
              bout.jpFighter,
              selectedFighter,
            );
            const opponent = selectedIsJapaneseSide
              ? bout.opponent
              : bout.jpFighter;
            const info = selectedIsJapaneseSide
              ? { country: bout.opponentCountry, gym: bout.opponentGym }
              : { country: bout.jpFighterCountry, gym: bout.jpFighterGym };
            return fighterNameCell(
              opponent,
              info,
              onSelectFighter,
              "font-semibold text-white",
            );
          },
          sortValue: (bout) =>
            sameFighterName(bout.jpFighter, selectedFighter) ? bout.opponent : bout.jpFighter,
          className: "min-w-32 font-semibold text-white",
        }
      : {
          id: "matchup",
          label: "対戦カード",
          render: (bout) => {
            const result = tableResult(bout);
            return (
              <div className="min-w-44">
                {fighterNameCell(
                  bout.jpFighter,
                  {
                    country: bout.jpFighterCountry,
                    gym: bout.jpFighterGym,
                  },
                  onSelectFighter,
                  result === "win" ? "font-semibold text-white" : "text-gray-300",
                )}
                <span className="mx-1.5 text-gray-600">vs</span>
                {fighterNameCell(
                  bout.opponent,
                  {
                    country: bout.opponentCountry,
                    gym: bout.opponentGym,
                  },
                  onSelectFighter,
                  result === "loss" ? "font-semibold text-white" : "text-gray-300",
                )}
              </div>
            );
          },
          sortValue: (bout) => `${bout.jpFighter} ${bout.opponent}`,
          className: "min-w-52",
        },
    {
      id: "result",
      label: fighterView ? "結果・予定" : "勝者・結果",
      render: (bout) =>
        fighterView
          ? resultBadge(tableResult(bout, selectedFighter))
          : boutOutcome(bout),
      sortValue: (bout) =>
        tableResult(bout, fighterView ? selectedFighter : undefined),
      align: "center",
    },
    ...(!fighterView
      ? [
          {
            id: "japanese-result",
            label: "日本人の結果",
            render: (bout: BoutWithEvent) => japaneseResultBadge(bout),
            sortValue: (bout: BoutWithEvent) => japaneseOutcome(bout) ?? "",
            align: "center" as const,
          },
        ]
      : []),
    {
      id: "title",
      label: "タイトル",
      render: (bout) => (
        <div className="flex flex-wrap gap-1">
          <BoutTitleBadges bout={bout} />
        </div>
      ),
      sortValue: (bout) =>
        titlesForBout(bout).map((title) => title.kind).join(" "),
    },
    {
      id: "weight",
      label: "階級",
      render: (bout) => bout.weightClass,
      sortValue: (bout) => bout.weightClass,
      hideOnMobile: true,
      className: "whitespace-nowrap",
    },
    {
      id: "method",
      label: "決着",
      render: (bout) =>
        bout.method ??
        (tableResult(bout, fighterView ? selectedFighter : undefined) === "unknown"
          ? "結果未取得"
          : bout.result === "scheduled"
            ? "—"
            : "記録なし"),
      sortValue: (bout) => bout.method,
      hideOnMobile: true,
      className: "whitespace-nowrap",
    },
    {
      id: "event",
      label: "興行",
      render: (bout) => (
        <div>
          <div>{bout.event.name || "—"}</div>
          {bout.event.series && (
            <div className="mt-0.5 text-[10px] text-gray-600">{bout.event.series}</div>
          )}
        </div>
      ),
      sortValue: (bout) => bout.event.name,
      hideOnMobile: true,
      className: "min-w-44",
    },
    {
      id: "venue",
      label: "会場",
      render: (bout) =>
        [bout.event.venue, bout.event.city].filter(Boolean).join("・") || "—",
      sortValue: (bout) => `${bout.event.city} ${bout.event.venue}`,
      hideOnMobile: true,
      className: "min-w-40",
    },
  ];
}

export default function BoxingDataTable({
  view,
  events,
  bouts,
  selectedFighter,
  onSelectFighter,
}: {
  view: BoxingTableView;
  events: BoxingEvent[];
  bouts: BoutWithEvent[];
  selectedFighter: string;
  onSelectFighter: (fighter: string) => void;
}) {
  if (view === "events") {
    return (
      <DataTable
        key="boxing-events"
        rows={events}
        columns={eventColumns()}
        rowKey={(event) => event.id}
        defaultSort={{ columnId: "date", direction: "desc" }}
      />
    );
  }

  return (
    <DataTable
      key={`boxing-${view}-${selectedFighter}`}
      rows={bouts}
      columns={boutColumns(view, selectedFighter, onSelectFighter)}
      rowKey={(bout) => `${bout.event.id}-${bout.id}`}
      defaultSort={{ columnId: "date", direction: "desc" }}
      emptyMessage={
        view === "fighter" && !selectedFighter
          ? "選手を選択すると、過去の試合結果と今後の試合予定を同じ表で表示します。"
          : "現在の条件に一致する試合がありません。"
      }
    />
  );
}
