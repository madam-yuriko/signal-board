import { NextResponse } from "next/server";
import {
  isCheckedCardItemForScope,
  isCheckedCardKey,
  isCheckedCardScope,
} from "@/lib/checkedCards";
import {
  deleteCheckedCard,
  listCheckedCards,
  upsertCheckedCard,
} from "@/lib/checkedCardsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readScope(value: string | null) {
  return isCheckedCardScope(value) ? value : undefined;
}

function invalidRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const scope = readScope(new URL(request.url).searchParams.get("scope"));
  if (!scope) return invalidRequest("保存対象の範囲が不正です。");
  return NextResponse.json(
    { cards: listCheckedCards(scope) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("JSONを読み取れません。");
  }
  if (!body || typeof body !== "object") return invalidRequest("保存データが不正です。");
  const payload = body as { scope?: unknown; key?: unknown; item?: unknown };
  if (!isCheckedCardScope(payload.scope) ||
    !isCheckedCardKey(payload.key) ||
    !isCheckedCardItemForScope(payload.scope, payload.item)) {
    return invalidRequest("保存データが不正です。");
  }
  const card = upsertCheckedCard(payload.scope, payload.key, payload.item);
  return NextResponse.json({ card }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("JSONを読み取れません。");
  }
  if (!body || typeof body !== "object") return invalidRequest("保存データが不正です。");
  const payload = body as {
    scope?: unknown;
    cards?: unknown;
  };
  if (!isCheckedCardScope(payload.scope) || !Array.isArray(payload.cards)) {
    return invalidRequest("移行データが不正です。");
  }
  const scope = payload.scope;
  if (payload.cards.length > 500) return invalidRequest("移行件数が多すぎます。");

  const cards = payload.cards.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const card = value as { key?: unknown; item?: unknown };
    if (!isCheckedCardKey(card.key) ||
      !isCheckedCardItemForScope(scope, card.item)) return [];
    return [{ key: card.key, item: card.item }];
  });
  if (cards.length !== payload.cards.length) return invalidRequest("移行データが不正です。");
  const stored = cards.map(({ key, item }) => upsertCheckedCard(scope, key, item));
  return NextResponse.json({ cards: stored }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = readScope(params.get("scope"));
  const key = params.get("key");
  if (!scope || !isCheckedCardKey(key)) return invalidRequest("削除対象が不正です。");
  deleteCheckedCard(scope, key);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
