"use client";

import { useEffect, useState } from "react";
import BoxingDashboard from "@/components/BoxingDashboard";
import type { BoxingFeed } from "@/lib/boxingFeed";

const CLIENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedFeed {
  feed: BoxingFeed;
  expiresAt: number;
}

let cachedFeed: CachedFeed | undefined;
let inFlight: Promise<BoxingFeed> | undefined;

function cachedValue(): BoxingFeed | undefined {
  if (!cachedFeed || cachedFeed.expiresAt <= Date.now()) {
    cachedFeed = undefined;
    return undefined;
  }
  return cachedFeed.feed;
}

async function requestFeed(): Promise<BoxingFeed> {
  if (!inFlight) {
    inFlight = fetch("/api/boxing", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as BoxingFeed | { error?: string };
        if (!response.ok || !("events" in body)) {
          throw new Error(
            "error" in body && body.error
              ? body.error
              : "ボクシングデータを取得できませんでした。",
          );
        }
        const sourceUpdatedAt = body.updatedAt
          ? new Date(body.updatedAt).getTime()
          : Number.NaN;
        cachedFeed = {
          feed: body,
          // APIを受け取った時点から24時間延長せず、サーバー側の更新時刻を
          // 基準にする。これにより画面キャッシュが古さを上乗せしない。
          expiresAt: Number.isFinite(sourceUpdatedAt)
            ? sourceUpdatedAt + CLIENT_CACHE_TTL_MS
            : Date.now() + CLIENT_CACHE_TTL_MS,
        };
        return body;
      })
      .finally(() => {
        inFlight = undefined;
      });
  }
  return inFlight;
}

function LoadingState() {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-sm text-gray-400">
      データを読み込み中…
    </div>
  );
}

export default function BoxingPageClient() {
  const [feed, setFeed] = useState<BoxingFeed | undefined>(() => cachedValue());
  const [loading, setLoading] = useState(() => !cachedValue());
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const current = cachedValue();
      if (current) {
        setFeed(current);
        setLoading(false);
        return;
      }

      setFeed(undefined);
      setLoading(true);
      setError(undefined);
      try {
        const nextFeed = await requestFeed();
        if (cancelled) return;
        setFeed(nextFeed);
        setLoading(false);
      } catch (nextError: unknown) {
        if (cancelled) return;
        setFeed(undefined);
        setLoading(false);
        setError(
          nextError instanceof Error
            ? nextError.message
            : "ボクシングデータを取得できませんでした。",
        );
      }
    };

    void load();
    const refreshTimer = window.setInterval(() => void load(), 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, []);

  if (loading) return <LoadingState />;
  if (!feed) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-rose-400/20 bg-rose-400/5 px-4 text-center text-sm text-rose-200">
        {error ?? "ボクシングデータを取得できませんでした。"}
      </div>
    );
  }

  return (
    <BoxingDashboard
      events={feed.events}
      sourceName={feed.sourceName}
      updatedAt={feed.updatedAt}
      warning={feed.warning}
    />
  );
}
