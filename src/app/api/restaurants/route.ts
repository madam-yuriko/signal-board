import { NextResponse } from "next/server";
import {
  deleteRestaurantWishlistItem,
  listRestaurantWishlist,
} from "@/lib/restaurantWishlistDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { records: listRestaurantWishlist() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  const tabelogId = new URL(request.url).searchParams.get("id")?.trim();
  if (!tabelogId) {
    return NextResponse.json({ error: "削除対象が不正です。" }, { status: 400 });
  }
  return deleteRestaurantWishlistItem(tabelogId)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "店舗が見つかりません。" }, { status: 404 });
}
