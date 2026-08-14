import type { Bout, Organization } from "@/types";
import { ORGANIZATIONS } from "@/types";

const REVALIDATE_SECONDS = 60 * 60 * 6;
const RESULT_PATTERN = /(?:TKO|KO|RTD|判定|負傷|棄権|失格|引分|ドロー|無効|NC)/i;

interface PdfTextItem {
  str: string;
  transform: number[];
}

interface PositionedText {
  text: string;
  x: number;
  y: number;
  size: number;
}

const WEIGHT_CLASSES: Record<string, string> = {
  Mm: "ミニマム級",
  "L.F": "ライトフライ級",
  F: "フライ級",
  "S.F": "スーパーフライ級",
  B: "バンタム級",
  "S.B": "スーパーバンタム級",
  Fe: "フェザー級",
  "S.Fe": "スーパーフェザー級",
  L: "ライト級",
  "S.L": "スーパーライト級",
  W: "ウェルター級",
  "S.W": "スーパーウェルター級",
  M: "ミドル級",
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function fighterName(
  items: PositionedText[],
  minX: number,
  maxX: number,
): string | undefined {
  const parts = items
    .filter(
      (item) =>
        item.x >= minX &&
        item.x <= maxX &&
        item.size >= 9 &&
        item.text.trim(),
    )
    .sort((a, b) => b.y - a.y || a.x - b.x);
  if (parts.length === 0) return undefined;

  const lines: Array<{ y: number; parts: PositionedText[] }> = [];
  for (const part of parts) {
    const line = lines.find((candidate) => Math.abs(candidate.y - part.y) < 2);
    if (line) line.parts.push(part);
    else lines.push({ y: part.y, parts: [part] });
  }

  return normalizeText(
    lines
      .sort((a, b) => b.y - a.y)
      .map((line) =>
        line.parts
          .sort((a, b) => a.x - b.x)
          .map((part) => part.text)
          .join(" "),
      )
      .join(""),
  );
}

function resultMethod(
  items: PositionedText[],
  minX: number,
  maxX: number,
): string | undefined {
  const result = items
    .filter((item) => item.x >= minX && item.x <= maxX)
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .find((item) => RESULT_PATTERN.test(item.text));
  if (!result) return undefined;

  return normalizeText(result.text)
    .replace(/(\d+)R\s*(\d+)'(\d+)"/, "$1R $2:$3")
    .replace(/(TKO|KO|RTD)(\d+R)/i, "$1 $2");
}

function weightClass(items: PositionedText[], markerY: number): string {
  const raw = normalizeText(
    items
      .filter(
        (item) =>
          item.x >= 39 &&
          item.x < 80 &&
          Math.abs(item.y - markerY) <= 6,
      )
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(" "),
  )
    .replace(/^\d+\s*/, "")
    .replace(/(?:勝|分)$/, "")
    .trim();

  if (WEIGHT_CLASSES[raw]) return WEIGHT_CLASSES[raw];
  if (/^\d+(?:\.\d+)?\s*P$/i.test(raw)) {
    return `${raw.replace(/\s*P$/i, "")}ポンド契約`;
  }
  if (/^\d+(?:\.\d+)?\s*kg$/i.test(raw)) {
    return `${raw.replace(/\s*kg$/i, "")}kg契約`;
  }
  if (/^(?:kg|P)$/i.test(raw)) return "契約階級";
  return raw || "契約階級";
}

function organizations(items: PositionedText[]): Organization[] {
  const rowText = items.map((item) => item.text).join(" ").toUpperCase();
  return ORGANIZATIONS.filter((organization) =>
    rowText.includes(organization),
  );
}

function parsePage(items: PositionedText[], eventId: string, page: number): Bout[] {
  const markers = items
    .filter(
      (item) =>
        item.x >= 20 &&
        item.x <= 36 &&
        /^\d{1,2}$/.test(item.text.trim()) &&
        item.y < 455,
    )
    .filter((marker) =>
      items.some(
        (item) =>
          item.x >= 39 &&
          item.x <= 88 &&
          Math.abs(item.y - marker.y) <= 6,
      ),
    )
    .sort((a, b) => b.y - a.y);

  return markers.flatMap((marker, index) => {
    const upper =
      index === 0 ? 455 : (markers[index - 1].y + marker.y) / 2;
    const lower =
      index === markers.length - 1
        ? marker.y - 30
        : (marker.y + markers[index + 1].y) / 2;
    const row = items.filter((item) => item.y < upper && item.y >= lower);
    const redName = fighterName(row, 150, 218);
    const blueName = fighterName(row, 435, 505);
    if (!redName || !blueName) return [];

    const redWon = row.some(
      (item) => item.x >= 80 && item.x <= 106 && item.text.includes("勝"),
    );
    const blueWon = row.some(
      (item) => item.x >= 360 && item.x <= 390 && item.text.includes("勝"),
    );
    const method = redWon
      ? resultMethod(row, 285, 370)
      : blueWon
        ? resultMethod(row, 570, 655)
        : resultMethod(row, 285, 655);

    return [
      {
        id: `${eventId}-p${page}-b${marker.text.trim()}`,
        jpFighter: redName,
        opponent: blueName,
        weightClass: weightClass(row, marker.y),
        organizations: organizations(row),
        result: redWon ? "win" : blueWon ? "loss" : "draw",
        method: method ?? (redWon || blueWon ? "勝利" : "引分"),
      },
    ];
  });
}

export async function parseJbcResultPdf(
  url: string,
  eventId: string,
): Promise<Bout[]> {
  const response = await fetch(url, {
    headers: { Accept: "application/pdf" },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`JBC PDF returned ${response.status}`);

  const data = new Uint8Array(await response.arrayBuffer());
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({ data, disableFontFace: true });

  try {
    const document = await loadingTask.promise;
    const bouts: Bout[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items.flatMap((item) => {
        if (!("str" in item) || !("transform" in item)) return [];
        const textItem = item as PdfTextItem;
        const [size = 0, , , , x = 0, y = 0] = textItem.transform;
        return [{ text: textItem.str, x, y, size: Math.abs(size) }];
      });
      bouts.push(...parsePage(items, eventId, pageNumber));
    }
    if (bouts.length > 0) bouts[0].isMainEvent = true;
    return bouts;
  } finally {
    await loadingTask.destroy();
  }
}
