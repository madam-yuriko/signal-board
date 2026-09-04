"use client";

import { useCallback, useEffect, useState } from "react";
import BoxingDashboard from "@/components/BoxingDashboard";
import type { BoxingFeed } from "@/lib/boxingFeed";
import type { FighterProfile } from "@/lib/fighterProfile";
import type { WikipediaFighterRecord } from "@/lib/fighterRecord";

const CLIENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CLIENT_CACHE_KEY = "signal-board:boxing-event-feed:v1";
const LEGACY_CLIENT_CACHE_KEYS = [
  "signal-board:boxing-feed:v7",
  "signal-board:boxing-feed:v6",
];

interface CachedFeed {
  feed: BoxingFeed;
  expiresAt: number;
}

interface FighterData {
  profiles: FighterProfile[];
  records: Record<string, WikipediaFighterRecord>;
}

let cachedFeed: CachedFeed | undefined;
let inFlight: Promise<BoxingFeed> | undefined;
let fighterDataInFlight: Promise<FighterData> | undefined;

function eventFeedOnly(feed: BoxingFeed): BoxingFeed {
  const eventFeed = { ...feed };
  delete eventFeed.fighterProfiles;
  delete eventFeed.fighterRecords;
  return eventFeed;
}

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
    for (const key of [CLIENT_CACHE_KEY, ...LEGACY_CLIENT_CACHE_KEYS]) {
      const serialized = window.localStorage.getItem(key);
      if (!serialized) continue;

      const parsed = JSON.parse(serialized) as Partial<CachedFeed>;
      if (
        typeof parsed.expiresAt !== "number" ||
        parsed.expiresAt <= Date.now() ||
        typeof parsed.feed !== "object" ||
        parsed.feed === null ||
        !Array.isArray(parsed.feed.events)
      ) {
        continue;
      }

      const nextCachedFeed: CachedFeed = {
        feed: eventFeedOnly(parsed.feed as BoxingFeed),
        expiresAt: parsed.expiresAt,
      };
      cachedFeed = nextCachedFeed;
      if (key !== CLIENT_CACHE_KEY) {
        window.localStorage.setItem(
          CLIENT_CACHE_KEY,
          JSON.stringify(nextCachedFeed),
        );
      }
      return nextCachedFeed.feed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function storeFeed(feed: BoxingFeed): void {
  const next: CachedFeed = {
    feed: eventFeedOnly(feed),
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

async function requestFighterData(): Promise<FighterData> {
  if (fighterDataInFlight) return fighterDataInFlight;

  fighterDataInFlight = (async () => {
    const response = await fetch("/api/boxing/fighters");
    const body = (await response.json()) as FighterData | { error?: string };
    if (!response.ok) {
      throw new Error(
        "error" in body && body.error
          ? body.error
          : "保存済みの選手データを取得できませんでした。",
      );
    }
    return body as FighterData;
  })();

  try {
    return await fighterDataInFlight;
  } finally {
    fighterDataInFlight = undefined;
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
  const [feed, setFeed] = useState<BoxingFeed>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const handleFighterDataChange = useCallback(
    (
      profiles: FighterProfile[],
      records: Record<string, WikipediaFighterRecord>,
    ) => {
      if (profiles.length === 0 && Object.keys(records).length === 0) return;
      setFeed((current) => {
        if (!current) return current;
        const profilesByKey = new Map(
          (current.fighterProfiles ?? []).map((profile) => [
            profile.fighterKey,
            profile,
          ]),
        );
        for (const profile of profiles) {
          profilesByKey.set(profile.fighterKey, profile);
        }
        const next = {
          ...current,
          fighterProfiles: [...profilesByKey.values()],
          fighterRecords: {
            ...(current.fighterRecords ?? {}),
            ...records,
          },
        };
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const current = cachedValue() ?? persistedValue();
      if (current) {
        try {
          const fighterData = await requestFighterData();
          if (cancelled) return;
          setFeed({
            ...current,
            fighterProfiles: fighterData.profiles,
            fighterRecords: fighterData.records,
          });
          setLoading(false);
          setError(undefined);
        } catch (loadError) {
          if (cancelled) return;
          setFeed(current);
          setLoading(false);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "保存済みの選手データを取得できませんでした。",
          );
        }
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
      profiles={feed.fighterProfiles ?? []}
      records={feed.fighterRecords ?? {}}
      onFighterDataChange={handleFighterDataChange}
      sourceName={feed.sourceName}
      updatedAt={feed.updatedAt}
      warning={feed.warning}
    />
  );
}
