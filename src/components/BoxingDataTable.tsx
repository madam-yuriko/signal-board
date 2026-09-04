"use client";

import { ExternalLink } from "lucide-react";
import type { BoutResult, BoxingEvent } from "@/types";
import type { BoutWithEvent } from "@/lib/filters";
import { formatShortDate, isEventUpcoming, weightRank } from "@/lib/format";
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
import {
  fighterBoutResult,
  formatRecordLine,
  type FighterRecordStats,
} from "@/lib/fighterRecord";
import { ageOnDate, type FighterProfile } from "@/lib/fighterProfile";

export type BoxingTableView =
  | "events"
  | "bouts"
  | "world"
  | "fighters"
  | "fighter";
type TableBoutResult = BoutResult | "unknown";

export interface ManagedFighter {
  id: string;
  name: string;
  gym?: string;
  country?: string;
  weightClasses: string[];
  boutCount: number;
  record: FighterRecordStats;
  lastBoutDate?: string;
  nextBoutDate?: string;
}

export function managedFighterCountry(fighter: ManagedFighter): string {
  // 海外国名は取り込み時に country へ移している。残ったJBC登録ジム所属者は日本扱い。
  return fighter.country ?? (fighter.gym ? "日本" : "不明");
}

export function managedFighterAffiliation(fighter: ManagedFighter): string {
  return fighter.gym ?? "所属不明";
}

function isContractWeightClass(weightClass: string): boolean {
  return /契約|キャッチ(?:ウェ|ウエ)イト/i.test(weightClass);
}

function compareFightersByPriority(
  left: ManagedFighter,
  right: ManagedFighter,
): number {
  const boutCount = right.record.total - left.record.total;
  if (boutCount !== 0) return boutCount;

  const wins = right.record.win - left.record.win;
  if (wins !== 0) return wins;

  return left.record.loss - right.record.loss;
}

function emptyRecord(): FighterRecordStats {
  return {
    total: 0,
    win: 0,
    ko: 0,
    loss: 0,
    draw: 0,
    noContest: 0,
    scheduled: 0,
    unknown: 0,
  };
}

function addBoutToRecord(
  record: FighterRecordStats,
  bout: BoutWithEvent,
  fighter: string,
) {
  const result = fighterBoutResult(bout, fighter);
  if (result === "cancelled") return;
  if (result === "scheduled") {
    if (isEventUpcoming(bout.event)) record.scheduled += 1;
    else record.unknown += 1;
    return;
  }

  record.total += 1;
  if (result === "win") {
    record.win += 1;
    if (
      !/判定/.test(bout.method ?? "") &&
      /(?:^|[^A-Za-z])T?KO/i.test(bout.method ?? "")
    ) {
      record.ko += 1;
    }
  } else if (result === "loss") {
    record.loss += 1;
  } else if (result === "draw") {
    record.draw += 1;
  } else {
    record.noContest += 1;
  }
}

export function availableFighters(bouts: BoutWithEvent[]): string[] {
  const names = new Map<string, string>();
  for (const name of bouts.flatMap((bout) => [bout.jpFighter, bout.opponent])) {
    if (!name) continue;
    const key = name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (!names.has(key)) names.set(key, name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, "ja"));
}

/** アプリに収録した対戦カードから重複のない選手台帳を作る。 */
export function managedFighters(bouts: BoutWithEvent[]): ManagedFighter[] {
  const fighters = new Map<
    string,
    Omit<ManagedFighter, "weightClasses" | "boutCount"> & {
      weightClasses: Set<string>;
      boutIds: Set<string>;
    }
  >();

  const addFighter = (
    name: string,
    info: { gym?: string; country?: string },
    bout: BoutWithEvent,
  ) => {
    if (!isSelectableFighter(name)) return;
    const id = normalizeFighterName(name);
    if (!id) return;
    const resolvedInfo = fighterInfo(name, info);
    const existing = fighters.get(id) ?? {
      id,
      name,
      gym: resolvedInfo.gym,
      country: resolvedInfo.country,
      weightClasses: new Set<string>(),
      boutIds: new Set<string>(),
      record: emptyRecord(),
    };
    existing.gym ??= resolvedInfo.gym;
    existing.country ??= resolvedInfo.country;
    if (bout.weightClass && !isContractWeightClass(bout.weightClass)) {
      existing.weightClasses.add(bout.weightClass);
    }
    const boutId = `${bout.event.id}:${bout.id}`;
    if (!existing.boutIds.has(boutId)) {
      existing.boutIds.add(boutId);
      addBoutToRecord(existing.record, bout, name);
    }
    if (isEventUpcoming(bout.event)) {
      if (!existing.nextBoutDate || bout.event.date < existing.nextBoutDate) {
        existing.nextBoutDate = bout.event.date;
      }
    } else if (!existing.lastBoutDate || bout.event.date > existing.lastBoutDate) {
      existing.lastBoutDate = bout.event.date;
    }
    fighters.set(id, existing);
  };

  for (const bout of bouts) {
    addFighter(
      bout.jpFighter,
      { gym: bout.jpFighterGym, country: bout.jpFighterCountry },
      bout,
    );
    addFighter(
      bout.opponent,
      { gym: bout.opponentGym, country: bout.opponentCountry },
      bout,
    );
  }

  return [...fighters.values()]
    .map((fighter) => ({
      id: fighter.id,
      name: fighter.name,
      gym: fighter.gym,
      country: fighter.country,
      weightClasses: [...fighter.weightClasses].sort(
        (left, right) => weightRank(left) - weightRank(right),
      ),
      boutCount: fighter.boutIds.size,
      record: fighter.record,
      lastBoutDate: fighter.lastBoutDate,
      nextBoutDate: fighter.nextBoutDate,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "ja"));
}

export function availableFighterWeightClasses(
  fighters: ManagedFighter[],
): string[] {
  return [
    ...new Set(
      fighters
        .flatMap((fighter) => fighter.weightClasses)
        .filter((weightClass) => weightClass.endsWith("級")),
    ),
  ].sort((left, right) => weightRank(left) - weightRank(right));
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

function fighterColumns(
  onSelectFighter: (fighter: string) => void,
  profiles: Record<string, FighterProfile>,
  wikipediaUrls: Record<string, string | null | undefined>,
): DataTableColumn<ManagedFighter>[] {
  return [
    {
      id: "name",
      label: "選手名",
      render: (fighter) => (
        <button
          type="button"
          onClick={() => onSelectFighter(fighter.name)}
          className="cursor-pointer text-left font-semibold text-white underline decoration-white/20 underline-offset-2 transition-colors hover:text-red-200 hover:decoration-red-300/60"
          aria-label={`${fighter.name}の選手別結果を表示`}
        >
          {fighter.name}
        </button>
      ),
      sortValue: (fighter) => fighter.name,
      primary: true,
      className: "min-w-40",
    },
    {
      id: "affiliation",
      label: "所属",
      render: (fighter) => fighter.gym ?? "—",
      sortValue: (fighter) => managedFighterAffiliation(fighter),
      className: "min-w-28",
    },
    {
      id: "wikipedia",
      label: "Wikipedia",
      render: (fighter) => {
        const url = wikipediaUrls[fighter.id] ?? profiles[fighter.id]?.sourceUrl;
        return url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:text-sky-100"
            aria-label={`${fighter.name}のWikipedia記事を開く`}
            title="Wikipedia記事を開く"
          >
            記事
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null;
      },
      sortValue: (fighter) =>
        (wikipediaUrls[fighter.id] ?? profiles[fighter.id]?.sourceUrl)
          ? 1
          : 0,
      className: "whitespace-nowrap",
    },
    {
      id: "country",
      label: "国籍",
      render: managedFighterCountry,
      sortValue: managedFighterCountry,
      className: "whitespace-nowrap",
    },
    {
      id: "birthplace",
      label: "出身地",
      render: (fighter) => profiles[fighter.id]?.birthplacePrefecture ?? "",
      sortValue: (fighter) => profiles[fighter.id]?.birthplacePrefecture,
      className: "whitespace-nowrap",
    },
    {
      id: "birth-date",
      label: "生年月日",
      render: (fighter) => profiles[fighter.id]?.birthDate ?? "",
      sortValue: (fighter) => profiles[fighter.id]?.birthDate,
      className: "whitespace-nowrap",
    },
    {
      id: "age",
      label: "年齢",
      render: (fighter) => {
        const age = ageOnDate(profiles[fighter.id]?.birthDate);
        return age === undefined ? "" : `${age}歳`;
      },
      sortValue: (fighter) => ageOnDate(profiles[fighter.id]?.birthDate),
      align: "right",
      className: "whitespace-nowrap",
    },
    {
      id: "stance",
      label: "構え",
      render: (fighter) => profiles[fighter.id]?.stance ?? "",
      sortValue: (fighter) => profiles[fighter.id]?.stance,
      className: "whitespace-nowrap",
    },
    {
      id: "weights",
      label: "階級",
      render: (fighter) => (
        <div className="flex flex-wrap gap-1">
          {fighter.weightClasses.map((weightClass) => (
            <span
              key={weightClass}
              className="rounded border border-sky-400/20 bg-sky-400/5 px-1.5 py-0.5 text-[10px] text-sky-200"
            >
              {weightClass}
            </span>
          ))}
        </div>
      ),
      sortValue: (fighter) =>
        Math.min(...fighter.weightClasses.map(weightRank)),
      className: "min-w-40",
    },
    {
      id: "record",
      label: "戦績",
      render: (fighter) => (
        <div className="whitespace-nowrap">
          {fighter.record.total > 0 ? formatRecordLine(fighter.record) : "—"}
          {fighter.record.unknown > 0 && (
            <div className="text-[10px] text-gray-600">
              結果未取得 {fighter.record.unknown}試合
            </div>
          )}
        </div>
      ),
      sortValue: (fighter) => fighter.record.win,
      className: "min-w-40",
    },
    {
      id: "bouts",
      label: "収録試合",
      render: (fighter) => `${fighter.boutCount}試合`,
      sortValue: (fighter) => fighter.boutCount,
      align: "right",
    },
    {
      id: "last",
      label: "最終試合",
      render: (fighter) =>
        fighter.lastBoutDate ? formatShortDate(fighter.lastBoutDate) : "—",
      sortValue: (fighter) => fighter.lastBoutDate,
      className: "whitespace-nowrap",
    },
    {
      id: "next",
      label: "次回予定",
      render: (fighter) =>
        fighter.nextBoutDate ? formatShortDate(fighter.nextBoutDate) : "—",
      sortValue: (fighter) => fighter.nextBoutDate,
      className: "whitespace-nowrap",
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
  fighters,
  fighterProfiles,
  wikipediaUrls,
  selectedFighter,
  onSelectFighter,
  onFighterPageChange,
}: {
  view: BoxingTableView;
  events: BoxingEvent[];
  bouts: BoutWithEvent[];
  fighters: ManagedFighter[];
  fighterProfiles: Record<string, FighterProfile>;
  wikipediaUrls: Record<string, string | null | undefined>;
  selectedFighter: string;
  onSelectFighter: (fighter: string) => void;
  onFighterPageChange?: (fighters: ManagedFighter[]) => void;
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

  if (view === "fighters") {
    return (
      <DataTable
        key={`boxing-fighters-${fighters.length}-${fighters[0]?.id ?? "empty"}-${fighters.at(-1)?.id ?? "empty"}`}
        rows={fighters}
        columns={fighterColumns(onSelectFighter, fighterProfiles, wikipediaUrls)}
        rowKey={(fighter) => fighter.id}
        defaultSort={{ columnId: "record", direction: "desc" }}
        defaultCompareRows={compareFightersByPriority}
        emptyMessage="選択した階級に一致する選手がいません。"
        onPageChange={(_, pageFighters) => onFighterPageChange?.(pageFighters)}
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
