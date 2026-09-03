import { NextResponse } from "next/server";
import type { FighterRecordResponse } from "@/lib/fighterRecord";
import { fetchWikipediaFighterRecord } from "@/lib/wikipediaFighterRecord";

export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 40;

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";

  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: "選手名を指定してください。" },
      { status: 400 },
    );
  }

  const record = await fetchWikipediaFighterRecord(name);
  const body: FighterRecordResponse = { found: Boolean(record), record };

  return NextResponse.json(body, {
    headers: {
      // 戦績はWikipedia側の更新頻度に合わせ、サーバー側で1日キャッシュする。
      "Cache-Control": "private, max-age=3600",
    },
  });
}
