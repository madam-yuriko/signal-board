"use client";

import { useEffect, useState } from "react";
import type {
  FighterRecordResponse,
  WikipediaFighterRecord,
} from "@/lib/fighterRecord";
import type { FighterProfile } from "@/lib/fighterProfile";

export type FighterRecordStatus = "idle" | "loading" | "ready" | "error";

export interface FighterRecordState {
  status: FighterRecordStatus;
  /** Wikipediaに戦績があった場合のみ入る。 */
  record?: WikipediaFighterRecord;
  /** Wikipediaから抽出・保存できたプロフィール。 */
  profile?: FighterProfile;
}

// 選手を切り替えながら見比べる操作が多いため、取得済みの戦績はタブ内に残す。
const cache = new Map<string, FighterRecordState>();
const failed = new Set<string>();
const inFlight = new Map<string, Promise<void>>();
const RECORD_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000;

function isFresh(state: FighterRecordState): boolean {
  const updatedAt = state.record?.updatedAt;
  if (!updatedAt) return false;
  return Date.now() - Date.parse(updatedAt) < RECORD_REFRESH_INTERVAL_MS;
}

function requestRecord(fighter: string): Promise<void> {
  const pending = inFlight.get(fighter);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(
        `/api/boxing/fighter?name=${encodeURIComponent(fighter)}`,
      );
      if (!response.ok) throw new Error("戦績を取得できませんでした。");
      const body = (await response.json()) as FighterRecordResponse;
      cache.set(fighter, {
        status: "ready",
        record: body.found ? body.record : undefined,
        profile: body.profile,
      });
      failed.delete(fighter);
    } catch {
      // 取得に失敗しても、本アプリの収録データで一覧は表示できる。
      failed.add(fighter);
    } finally {
      inFlight.delete(fighter);
    }
  })();

  inFlight.set(fighter, request);
  return request;
}

/** 選手名からWikipediaの戦績を取得する。空文字なら何もしない。 */
export function useFighterRecord(fighter: string): FighterRecordState {
  // 取得完了を描画へ反映させるためだけのカウンタ。値そのものは読まない。
  const [, setRevision] = useState(0);

  useEffect(() => {
    if (!fighter || (cache.has(fighter) && isFresh(cache.get(fighter)!)) || failed.has(fighter)) {
      return;
    }
    cache.delete(fighter);

    let cancelled = false;
    void requestRecord(fighter).then(() => {
      if (!cancelled) setRevision((current) => current + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [fighter]);

  if (!fighter) return { status: "idle" };
  const cached = cache.get(fighter);
  if (cached && isFresh(cached)) {
    return cached;
  }
  return { status: failed.has(fighter) ? "error" : "loading" };
}
