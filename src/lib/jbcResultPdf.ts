import type { Bout } from "@/types";
import { organizationsFromText } from "@/lib/organizations";

const REVALIDATE_SECONDS = 60 * 60 * 24;
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
        item.size >= 6 &&
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

  const name = normalizeText(
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
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2}/u.test(name)
    ? name
    : undefined;
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
          Math.abs(item.y - markerY) <= 14,
      )
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(" "),
  )
    .normalize("NFKC")
    .replace(/(\d),(?=\d)/g, "$1.")
    // JBC PDFではラウンド数と階級が一つのテキスト片になる場合がある
    // （例: "8 110 P"）。契約重量そのものの "110 P" は残す。
    .replace(
      /^\d{1,2}\s+(?=(?:Mm|L\.F|F|S\.F|B|S\.B|Fe|S\.Fe|L|S\.L|W|S\.W|M|\d+(?:\.\d+)?\s*(?:kg|P))\b)/i,
      "",
    )
    .replace(/(?:勝|分)$/, "")
    .trim();

  if (WEIGHT_CLASSES[raw]) return WEIGHT_CLASSES[raw];
  const pounds = raw.match(/^(\d+(?:\.\d+)?)\s*P$/i);
  if (pounds) {
    const kilograms = Math.round(Number(pounds[1]) * 0.45359237 * 10) / 10;
    return `${kilograms.toFixed(1)}kg契約`;
  }
  if (/^\d+(?:\.\d+)?\s*kg$/i.test(raw)) {
    return `${raw.replace(/\s*kg$/i, "")}kg契約`;
  }
  if (/^(?:kg|P)$/i.test(raw)) return "契約階級";
  return raw || "契約階級";
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
    const explicitRedWin = row.some(
      (item) => item.x >= 80 && item.x <= 106 && item.text.includes("勝"),
    );
    const explicitBlueWin = row.some(
      (item) => item.x >= 360 && item.x <= 390 && item.text.includes("勝"),
    );
    const redMethod = resultMethod(row, 285, 370);
    const blueMethod = resultMethod(row, 570, 655);
    const redWon = explicitRedWin || (!explicitBlueWin && Boolean(redMethod) && !blueMethod);
    const blueWon = explicitBlueWin || (!explicitRedWin && Boolean(blueMethod) && !redMethod);
    const method = redWon
      ? redMethod
      : blueWon
        ? blueMethod
        : redMethod ?? blueMethod ?? resultMethod(row, 285, 655);
    // 旧様式PDFでは選手名が図形化され、pdf.jsで文字を取得できない。
    // その場合も試合番号・勝敗・決着を保持し、呼び出し側でカード順と照合する。
    if ((!redName || !blueName) && !method && !redWon && !blueWon) return [];
    const boutNumber = marker.text.trim();

    return [
      {
        id: `${eventId}-p${page}-b${boutNumber}`,
        jpFighter: redName ?? `__jbc_red_${boutNumber}`,
        opponent: blueName ?? `__jbc_blue_${boutNumber}`,
        weightClass: weightClass(row, marker.y),
        organizations: organizationsFromText(row.map((item) => item.text).join(" ")),
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
