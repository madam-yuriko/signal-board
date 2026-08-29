import { NextResponse } from "next/server";
import { BoxingFeedError, getBoxingFeed } from "@/lib/boxingFeed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const feed = await getBoxingFeed();
    return NextResponse.json(feed, {
      headers: {
        // 更新頻度はboxingFeedの1日キャッシュで管理する。API応答をさらに
        // 24時間キャッシュすると、最新カードの反映がもう1日遅れる。
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof BoxingFeedError
      ? error.message
      : "ボクシングデータを取得できませんでした。";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
