"use client";

import type { BoutResult, BoxingEvent } from "@/types";
import type { BoutWithEvent } from "@/lib/filters";
import { formatShortDate, isEventUpcoming } from "@/lib/format";
import DataTable, { type DataTableColumn } from "@/components/DataTable";
import OrgBadge from "@/components/OrgBadge";

export type BoxingTableView = "events" | "bouts" | "world" | "fighter";

export function availableFighters(bouts: BoutWithEvent[]): string[] {
  return [...new Set(bouts.flatMap((bout) => [bout.jpFighter, bout.opponent]))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ja"));
}

export function isWorldTitleBout(bout: BoutWithEvent): boolean {
  if (bout.organizations.length === 0) return false;
  const description = `${bout.notes ?? ""} ${bout.event.name}`;
  const boutDescription = bout.notes ?? "";
  if (
    /WBO[-\s]?AP|OPBF|東洋太平洋|アジア|Asia(?:n)?|日本(?:王座|タイトル|ユース)|ユース/i.test(
      boutDescription,
    )
  ) {
    return false;
  }
  return (
    /世界/.test(description) ||
    /王者|王座|防衛|挑戦|統一/.test(boutDescription)
  );
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
    return fighter
      ? bouts.filter(
          (bout) => bout.jpFighter === fighter || bout.opponent === fighter,
        )
      : [];
  }
  return bouts;
}

function resultForFighter(bout: BoutWithEvent, fighter: string): BoutResult {
  if (bout.result === "scheduled" || bout.result === "draw") return bout.result;
  if (bout.jpFighter === fighter) return bout.result;
  return bout.result === "win" ? "loss" : "win";
}

function resultBadge(result: BoutResult) {
  const styles: Record<BoutResult, string> = {
    win: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    loss: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    draw: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    scheduled: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  };
  const labels: Record<BoutResult, string> = {
    win: "勝",
    loss: "敗",
    draw: "引分",
    scheduled: "予定",
  };
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold ${styles[result]}`}>
      {labels[result]}
    </span>
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
          render: (bout) =>
            bout.jpFighter === selectedFighter ? bout.opponent : bout.jpFighter,
          sortValue: (bout) =>
            bout.jpFighter === selectedFighter ? bout.opponent : bout.jpFighter,
          className: "min-w-32 font-semibold text-white",
        }
      : {
          id: "matchup",
          label: "対戦カード",
          render: (bout) => (
            <div className="min-w-44">
              <span className="font-semibold text-white">{bout.jpFighter}</span>
              <span className="mx-1.5 text-gray-600">vs</span>
              <span>{bout.opponent}</span>
            </div>
          ),
          sortValue: (bout) => `${bout.jpFighter} ${bout.opponent}`,
          className: "min-w-52",
        },
    {
      id: "result",
      label: fighterView ? "戦績" : "結果（日本側）",
      render: (bout) =>
        resultBadge(
          fighterView ? resultForFighter(bout, selectedFighter) : bout.result,
        ),
      sortValue: (bout) =>
        fighterView ? resultForFighter(bout, selectedFighter) : bout.result,
      align: "center",
    },
    {
      id: "title",
      label: "タイトル",
      render: (bout) =>
        bout.organizations.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {bout.organizations.map((organization) => (
              <OrgBadge key={organization} org={organization} />
            ))}
          </div>
        ) : (
          <span className="text-gray-600">—</span>
        ),
      sortValue: (bout) => bout.organizations.join(" "),
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
      render: (bout) => bout.method ?? (bout.result === "scheduled" ? "—" : "記録なし"),
      sortValue: (bout) => bout.method,
      hideOnMobile: true,
      className: "whitespace-nowrap",
    },
    {
      id: "event",
      label: "興行",
      render: (bout) => (
        <div>
          <div>{bout.event.name}</div>
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
      render: (bout) => `${bout.event.venue}・${bout.event.city}`,
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
}: {
  view: BoxingTableView;
  events: BoxingEvent[];
  bouts: BoutWithEvent[];
  selectedFighter: string;
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
      columns={boutColumns(view, selectedFighter)}
      rowKey={(bout) => `${bout.event.id}-${bout.id}`}
      defaultSort={{ columnId: "date", direction: "desc" }}
      emptyMessage={
        view === "fighter" && !selectedFighter
          ? "選手を選択すると、現在収録している試合だけで戦績を表示します。"
          : "現在の条件に一致する試合がありません。"
      }
    />
  );
}
