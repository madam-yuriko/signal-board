import { NextResponse } from "next/server";
import { BoxingFeedError, getBoxingFeed } from "@/lib/boxingFeed";

export const revalidate = 86400;

export async function GET() {
  try {
    const feed = await getBoxingFeed();
    return NextResponse.json(feed, {
      headers: {
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    const message = error instanceof BoxingFeedError
      ? error.message
      : "ボクシングデータを取得できませんでした。";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
