import type { BoutResult, BoxingEvent } from "@/types";
import type { BoutWithEvent } from "@/lib/filters";
import { isEventUpcoming } from "@/lib/format";
import { normalizeFighterName, sameFighterName } from "@/lib/fighterInfo";
import { organizationsFromText } from "@/lib/organizations";

/** Wikipediaの戦績表から取り出した1試合。選手本人から見た結果を持つ。 */
export interface FighterRecordBout {
  /** 戦績表の「戦」列。通算何戦目か。 */
  order: number;
  /** yyyy-mm-dd */
  date: string;
  /** 本人から見た勝敗。未確定・未記載は scheduled。 */
  result: BoutResult;
  /** 例: "KO 4R 2:04" / "判定3-0 12R" */
  method?: string;
  opponent: string;
  opponentGym?: string;
  opponentCountry?: string;
  /** 備考から判別できた場合のみ */
  weightClass?: string;
  /** 戦績表の備考。タイトル判定に使う。 */
  notes?: string;
}

export interface WikipediaFighterRecord {
  /** 問い合わせに使った選手名 */
  fighter: string;
  /** 実際に参照したWikipediaの記事名 */
  pageTitle: string;
  pageUrl: string;
  bouts: FighterRecordBout[];
}

export interface FighterRecordResponse {
  found: boolean;
  record?: WikipediaFighterRecord;
}

/** 一覧の元データがWikipediaか、本アプリの収録データか。 */
export type FighterRecordSource = "wikipedia" | "database";

export interface FighterRecordStats {
  /** 勝敗が確定した試合数 */
  total: number;
  win: number;
  /** KO・TKOによる勝ち */
  ko: number;
  loss: number;
  draw: number;
  noContest: number;
  /** これからの試合 */
  scheduled: number;
  /** 開催済みだが結果を取得できていない試合 */
  unknown: number;
}

/** 選手本人から見た勝敗へ読み替える。データ上の result は左側選手視点。 */
export function fighterBoutResult(
  bout: Pick<BoutWithEvent, "jpFighter" | "result">,
  fighter: string,
): BoutResult {
  if (
    bout.result === "scheduled" ||
    bout.result === "draw" ||
    bout.result === "no-contest" ||
    bout.result === "cancelled"
  ) {
    return bout.result;
  }
  if (sameFighterName(bout.jpFighter, fighter)) return bout.result;
  return bout.result === "win" ? "loss" : "win";
}

function isKnockout(method?: string): boolean {
  if (!method) return false;
  if (/判定/.test(method)) return false;
  return /(?:^|[^A-Za-z])T?KO/i.test(method);
}

export function summarizeFighterRecord(
  bouts: BoutWithEvent[],
  fighter: string,
): FighterRecordStats {
  const stats: FighterRecordStats = {
    total: 0,
    win: 0,
    ko: 0,
    loss: 0,
    draw: 0,
    noContest: 0,
    scheduled: 0,
    unknown: 0,
  };

  for (const bout of bouts) {
    const result = fighterBoutResult(bout, fighter);
    if (result === "cancelled") continue;
    if (result === "scheduled") {
      if (isEventUpcoming(bout.event)) stats.scheduled += 1;
      else stats.unknown += 1;
      continue;
    }

    stats.total += 1;
    if (result === "win") {
      stats.win += 1;
      if (isKnockout(bout.method)) stats.ko += 1;
    } else if (result === "loss") {
      stats.loss += 1;
    } else if (result === "draw") {
      stats.draw += 1;
    } else {
      stats.noContest += 1;
    }
  }

  return stats;
}

/** "33戦 33勝（27KO）0敗 0分" */
export function formatRecordLine(stats: FighterRecordStats): string {
  const base = `${stats.total}戦 ${stats.win}勝（${stats.ko}KO）${stats.loss}敗 ${stats.draw}分`;
  return stats.noContest > 0 ? `${base} ${stats.noContest}無効` : base;
}

const MATCH_WINDOW_DAYS = 7;

function dayDistance(left: string, right: string): number {
  const a = Date.parse(`${left}T00:00:00`);
  const b = Date.parse(`${right}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / 86_400_000;
}

/** 収録データ側で、その選手から見た対戦相手の情報を取り出す。 */
function opponentSide(bout: BoutWithEvent, fighter: string) {
  const fighterIsLeft = sameFighterName(bout.jpFighter, fighter);
  return {
    name: fighterIsLeft ? bout.opponent : bout.jpFighter,
    gym: fighterIsLeft ? bout.opponentGym : bout.jpFighterGym,
    country: fighterIsLeft ? bout.opponentCountry : bout.jpFighterCountry,
    ownGym: fighterIsLeft ? bout.jpFighterGym : bout.opponentGym,
  };
}

function findDatabaseMatch(
  entry: FighterRecordBout,
  candidates: BoutWithEvent[],
  used: Set<BoutWithEvent>,
  fighter: string,
): BoutWithEvent | undefined {
  const sameDate = candidates.find(
    (bout) => !used.has(bout) && bout.event.date === entry.date,
  );
  if (sameDate) return sameDate;

  // 日付が数日ずれて記録されている場合に備え、対戦相手名でも突き合わせる。
  const opponentKey = normalizeFighterName(entry.opponent);
  if (!opponentKey) return undefined;
  return candidates.find(
    (bout) =>
      !used.has(bout) &&
      normalizeFighterName(opponentSide(bout, fighter).name) === opponentKey &&
      dayDistance(bout.event.date, entry.date) <= MATCH_WINDOW_DAYS,
  );
}

function syntheticEvent(
  fighter: string,
  entry: FighterRecordBout,
  record: WikipediaFighterRecord,
): BoxingEvent {
  return {
    id: `wikipedia-${normalizeFighterName(fighter)}-${entry.order}`,
    date: entry.date,
    name: "",
    venue: "",
    city: "",
    // 会場が分からないため国内外は判定できない。フィルタ対象外の一覧でのみ使う。
    domestic: true,
    bouts: [],
    sourceName: "Wikipedia",
    sourceUrl: record.pageUrl,
  };
}

/**
 * 選手別一覧に並べる試合を作る。
 * Wikipediaに戦績があればそちらを正本とし、収録済み興行の会場・階級などで補完する。
 * Wikipediaに無い今後の試合予定は、本アプリの収録データから追加する。
 */
export function buildFighterBouts(
  fighter: string,
  databaseBouts: BoutWithEvent[],
  record?: WikipediaFighterRecord,
): { bouts: BoutWithEvent[]; source: FighterRecordSource } {
  if (!fighter) return { bouts: [], source: "database" };
  if (!record || record.bouts.length === 0) {
    return { bouts: databaseBouts, source: "database" };
  }

  const used = new Set<BoutWithEvent>();
  const bouts = record.bouts.map((entry) => {
    const match = findDatabaseMatch(entry, databaseBouts, used, fighter);
    if (match) used.add(match);
    const side = match ? opponentSide(match, fighter) : undefined;

    return {
      id: `wikipedia-${entry.order}`,
      jpFighter: fighter,
      jpFighterGym: side?.ownGym,
      opponent: entry.opponent,
      opponentGym: entry.opponentGym ?? side?.gym,
      opponentCountry: entry.opponentCountry ?? side?.country,
      weightClass: match?.weightClass ?? entry.weightClass ?? "—",
      organizations: organizationsFromText(entry.notes ?? ""),
      result: entry.result,
      method: entry.method ?? match?.method,
      notes: entry.notes || match?.notes,
      event: match?.event ?? syntheticEvent(fighter, entry, record),
    } satisfies BoutWithEvent;
  });

  // Wikipediaが未反映の今後の試合は、本アプリが持っている予定で補う。
  const upcomingOnly = databaseBouts.filter(
    (bout) => !used.has(bout) && isEventUpcoming(bout.event),
  );

  return { bouts: [...bouts, ...upcomingOnly], source: "wikipedia" };
}
