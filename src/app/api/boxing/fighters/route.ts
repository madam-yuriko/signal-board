import { NextResponse } from "next/server";
import { normalizeFighterName } from "@/lib/fighterInfo";
import {
  listFighterProfiles,
  upsertFighterProfile,
} from "@/lib/fighterProfilesDb";
import {
  listFighterRecords,
  upsertFighterRecord,
} from "@/lib/fighterRecordsDb";
import {
  listFighterWikipediaStatuses,
  upsertFighterWikipediaStatus,
} from "@/lib/fighterWikipediaStatusDb";
import { fetchWikipediaFighterUrls } from "@/lib/wikipediaFighterRecord";

export const dynamic = "force-dynamic";

// 1回の処理が長くなりすぎないよう、クライアント側で小分けに送る。
const MAX_FIGHTERS = 300;
const MAX_NAME_LENGTH = 40;
const WIKIPEDIA_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000;

function isFresh(value?: string): boolean {
  if (!value) return false;
  const checkedAt = Date.parse(value);
  return (
    Number.isFinite(checkedAt) &&
    Date.now() - checkedAt < WIKIPEDIA_REFRESH_INTERVAL_MS
  );
}

/** 保存済み選手データだけを返す。Wikipediaへの外部アクセスは行わない。 */
export async function GET() {
  return NextResponse.json(
    {
      profiles: listFighterProfiles(),
      records: listFighterRecords(),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "選手一覧を指定してください。" }, { status: 400 });
  }

  const names = Array.isArray((body as { names?: unknown })?.names)
    ? (body as { names: unknown[] }).names.filter(
        (name): name is string =>
          typeof name === "string" &&
          name.trim().length > 0 &&
          name.trim().length <= MAX_NAME_LENGTH,
      )
    : [];

  if (names.length === 0 || names.length > MAX_FIGHTERS) {
    return NextResponse.json({ error: "選手一覧を指定してください。" }, { status: 400 });
  }

  try {
    const profilesByKey = Object.fromEntries(
      listFighterProfiles().map((profile) => [profile.fighterKey, profile]),
    );
    const recordsByKey = listFighterRecords();
    const statusesByKey = listFighterWikipediaStatuses();
    const staleNames = names.filter((name) => {
      const key = normalizeFighterName(name);
      return !(
        isFresh(statusesByKey[key]?.checkedAt) ||
        isFresh(recordsByKey[key]?.updatedAt)
      );
    });
    const fetched =
      staleNames.length > 0
        ? await fetchWikipediaFighterUrls(staleNames)
        : [];
    const fetchedByKey = new Map(
      fetched.map((fighter) => {
        const key = normalizeFighterName(fighter.fighterName);
        const profile = fighter.profile
          ? upsertFighterProfile(fighter.profile)
          : undefined;
        const record = fighter.record
          ? upsertFighterRecord(fighter.record)
          : undefined;
        const status = upsertFighterWikipediaStatus(
          fighter.fighterName,
          fighter.wikipediaUrl,
        );
        return [
          key,
          {
            fighterName: fighter.fighterName,
            wikipediaUrl: status?.wikipediaUrl,
            profile:
              status?.wikipediaUrl
                ? profile ?? profilesByKey[key]
                : undefined,
            record:
              status?.wikipediaUrl
                ? record ?? recordsByKey[key]
                : undefined,
          },
        ] as const;
      }),
    );
    const persisted = names.map((fighterName) => {
      const key = normalizeFighterName(fighterName);
      const fetchedFighter = fetchedByKey.get(key);
      if (fetchedFighter) return fetchedFighter;

      const status = statusesByKey[key];
      const profile = profilesByKey[key];
      const record = recordsByKey[key];
      const wikipediaUrl =
        status?.wikipediaUrl ?? profile?.sourceUrl ?? record?.pageUrl;
      return {
        fighterName,
        wikipediaUrl,
        profile: wikipediaUrl ? profile : undefined,
        record: wikipediaUrl ? record : undefined,
      };
    });
    return NextResponse.json(
      { fighters: persisted },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Unable to check boxing fighter Wikipedia pages", error);
    return NextResponse.json(
      { error: "Wikipediaのページ確認に失敗しました。時間を置いて再試行してください。" },
      { status: 502 },
    );
  }
}
