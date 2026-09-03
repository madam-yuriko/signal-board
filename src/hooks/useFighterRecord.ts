"use client";

import { useEffect, useState } from "react";
import type {
  FighterRecordResponse,
  WikipediaFighterRecord,
} from "@/lib/fighterRecord";

export type FighterRecordStatus = "idle" | "loading" | "ready" | "error";

export interface FighterRecordState {
  status: FighterRecordStatus;
  /** Wikipediaに戦績があった場合のみ入る。 */
  record?: WikipediaFighterRecord;
}

// 選手を切り替えながら見比べる操作が多いため、取得済みの戦績はタブ内に残す。
const cache = new Map<string, WikipediaFighterRecord | undefined>();
const failed = new Set<string>();
const inFlight = new Map<string, Promise<void>>();

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
      cache.set(fighter, body.found ? body.record : undefined);
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
    if (!fighter || cache.has(fighter) || failed.has(fighter)) return;

    let cancelled = false;
    void requestRecord(fighter).then(() => {
      if (!cancelled) setRevision((current) => current + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [fighter]);

  if (!fighter) return { status: "idle" };
  if (cache.has(fighter)) {
    return { status: "ready", record: cache.get(fighter) };
  }
  return { status: failed.has(fighter) ? "error" : "loading" };
}
