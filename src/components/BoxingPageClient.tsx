"use client";

import { useEffect, useState } from "react";
import BoxingDashboard from "@/components/BoxingDashboard";
import type { BoxingFeed } from "@/lib/boxingFeed";

const CLIENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// 取得ロジックを変えた時はキーを上げる。上げないと、既存の利用者は
// 最大24時間、古い（カードが欠けた）フィードを見続けることになる。
const CLIENT_CACHE_KEY = "signal-board:boxing-feed:v2";

interface CachedFeed {
  feed: BoxingFeed;
  expiresAt: number;
}

let cachedFeed: CachedFeed | undefined;
let inFlight: Promise<BoxingFeed> | undefined;

function cacheExpiry(feed: BoxingFeed): number {
  const fetchedAt = feed.fetchedAt ? Date.parse(feed.fetchedAt) : Number.NaN;
  const cachedAt = Number.isFinite(fetchedAt) ? fetchedAt : Date.now();
  return cachedAt + CLIENT_CACHE_TTL_MS;
}

function cachedValue(): BoxingFeed | undefined {
  if (!cachedFeed) return undefined;
  if (cachedFeed.expiresAt <= Date.now()) {
    cachedFeed = undefined;
    return undefined;
  }
  return cachedFeed.feed;
}

function persistedValue(): BoxingFeed | undefined {
  try {
    const serialized = window.localStorage.getItem(CLIENT_CACHE_KEY);
    if (!serialized) return undefined;

    const parsed = JSON.parse(serialized) as Partial<CachedFeed>;
    const valid =
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > Date.now() &&
      typeof parsed.feed === "object" &&
      parsed.feed !== null &&
      Array.isArray(parsed.feed.events);

    if (!valid) {
      window.localStorage.removeItem(CLIENT_CACHE_KEY);
      return undefined;
    }

    cachedFeed = parsed as CachedFeed;
    return cachedFeed.feed;
  } catch {
    return undefined;
  }
}

function storeFeed(feed: BoxingFeed): void {
  const next: CachedFeed = {
    feed,
    expiresAt: cacheExpiry(feed),
  };
  cachedFeed = next;

  try {
    window.localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable. The in-memory cache still prevents repeat loads.
  }
}

async function requestFeed(): Promise<BoxingFeed> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    // cache: "no-store" はブラウザが Cache-Control: no-cache を送るため、
    // Next がサーバー側のデータキャッシュをバイパスし、フィード全体
    // （ボクモバ興行詳細＋JBC＋結果PDF解析）を毎回作り直してしまう。
    // 応答自体は private, no-store を返すのでブラウザには残らない。
    const response = await fetch("/api/boxing");
    const body = (await response.json()) as BoxingFeed | { error?: string };

    if (!response.ok) {
      throw new Error(
        "error" in body && body.error
          ? body.error
          : "ボクシングデータを取得できませんでした。",
      );
    }

    const feed = body as BoxingFeed;
    storeFeed(feed);
    return feed;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = undefined;
  }
}

function LoadingState() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-none px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        データを読み込み中…
      </div>
    </main>
  );
}

export default function BoxingPageClient() {
  const initialFeed = cachedValue();
  const [feed, setFeed] = useState<BoxingFeed | undefined>(initialFeed);
  const [loading, setLoading] = useState(!initialFeed);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const current = cachedValue() ?? persistedValue();
      if (current) {
        await Promise.resolve();
        if (cancelled) return;
        setFeed(current);
        setLoading(false);
        setError(undefined);
        return;
      }

      setLoading(true);
      setError(undefined);

      try {
        const next = await requestFeed();
        if (cancelled) return;
        setFeed(next);
        setLoading(false);
      } catch (loadError) {
        if (cancelled) return;
        setFeed(undefined);
        setLoading(false);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "ボクシングデータを取得できませんでした。",
        );
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingState />;

  if (!feed) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-none px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-900/60 bg-red-950/30 p-6 text-red-200">
          <p className="font-semibold">ボクシングデータを表示できませんでした。</p>
          {error ? <p className="mt-2 text-sm">{error}</p> : null}
        </div>
      </main>
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
