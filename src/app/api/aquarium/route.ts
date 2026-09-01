import { NextResponse } from "next/server";
import {
  createAquariumRecord,
  deleteAquariumRecord,
  listAquariumRecords,
  updateAquariumRecord,
  type AquariumRecordInput,
} from "@/lib/aquariumDb";
import { fetchAquariumProfile } from "@/lib/aquariumProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function integer(form: FormData, key: string, fallback?: number): number | undefined {
  const value = text(form, key);
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundedYen(form: FormData, key: string): number | undefined {
  const value = text(form, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

async function parseInput(request: Request): Promise<AquariumRecordInput | string> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return "登録内容を読み込めませんでした。";
  }
  const name = text(form, "name");
  const acquiredDate = text(form, "acquiredDate");
  const quantity = integer(form, "quantity", 1);
  if (!name || !acquiredDate) {
    return "生体名と購入日を確認してください。";
  }
  if (quantity === undefined || quantity < 1) {
    return "購入数を確認してください。";
  }
  const unitPrice = roundedYen(form, "unitPrice");
  if (unitPrice !== undefined && unitPrice < 0) return "1匹あたりの購入価格を確認してください。";

  const photoValue = form.get("photo");
  let photo: Uint8Array | undefined;
  let photoMime: string | undefined;
  if (photoValue instanceof File && photoValue.size > 0) {
    if (photoValue.size > MAX_PHOTO_BYTES) return "写真は8MB以下にしてください。";
    if (!PHOTO_TYPES.has(photoValue.type)) return "JPEG・PNG・WebP・GIFの写真を選んでください。";
    photo = new Uint8Array(await photoValue.arrayBuffer());
    photoMime = photoValue.type;
  }

  const wikipediaName = text(form, "wikipediaName");
  const profile = await fetchAquariumProfile(wikipediaName ?? name);
  return {
    name,
    acquiredDate,
    quantity,
    unitPrice,
    store: text(form, "store"),
    tank: text(form, "tank"),
    deathDate: text(form, "deathDate"),
    notes: text(form, "notes"),
    profile,
    wikipediaName,
    photo,
    photoMime,
    removePhoto: text(form, "removePhoto") === "true",
  };
}

export async function GET() {
  return NextResponse.json(
    { records: listAquariumRecords() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const input = await parseInput(request);
  if (typeof input === "string") return badRequest(input);
  return NextResponse.json({ record: createAquariumRecord(input) }, { status: 201 });
}

export async function PUT(request: Request) {
  const id = Number.parseInt(new URL(request.url).searchParams.get("id") ?? "", 10);
  if (!Number.isFinite(id) || id < 1) return badRequest("更新対象が不正です。");
  const input = await parseInput(request);
  if (typeof input === "string") return badRequest(input);
  const record = updateAquariumRecord(id, input);
  return record
    ? NextResponse.json({ record })
    : NextResponse.json({ error: "記録が見つかりません。" }, { status: 404 });
}

export async function DELETE(request: Request) {
  const id = Number.parseInt(new URL(request.url).searchParams.get("id") ?? "", 10);
  if (!Number.isFinite(id) || id < 1) return badRequest("削除対象が不正です。");
  return deleteAquariumRecord(id)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "記録が見つかりません。" }, { status: 404 });
}
