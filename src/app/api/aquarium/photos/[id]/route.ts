import { getAquariumPhoto } from "@/lib/aquariumDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: idValue } = await context.params;
  const id = Number.parseInt(idValue, 10);
  const photo = Number.isFinite(id) ? getAquariumPhoto(id) : undefined;
  if (!photo) return new Response("Not found", { status: 404 });
  const body = new ArrayBuffer(photo.data.byteLength);
  new Uint8Array(body).set(photo.data);
  return new Response(body, {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      ...(photo.updatedAt ? { "Last-Modified": new Date(photo.updatedAt).toUTCString() } : {}),
    },
  });
}
