import "server-only";

import { unstable_cache } from "next/cache";
import { normalizeCountry, normalizeFighterName } from "@/lib/fighterInfo";
import type {
  FighterRecordBout,
  WikipediaFighterRecord,
} from "@/lib/fighterRecord";
import type { BoutResult } from "@/types";

const WIKIPEDIA_API = "https://ja.wikipedia.org/w/api.php";
const WIKIPEDIA_PAGE = "https://ja.wikipedia.org/wiki/";
const USER_AGENT = "SignalBoard/1.0 (+personal boxing dashboard)";
const REVALIDATE_SECONDS = 60 * 60 * 24;
const TIMEOUT_MS = 12_000;
const MAX_SEARCH_CANDIDATES = 2;

// プロボクシング以外の戦績表（エキシビション、キック、MMA、アマチュア）は使わない。
const EXCLUDED_SECTION =
  /エキシビ|アマチュア|キック|総合格闘技|ミックス|ムエタイ|空手|MMA/i;
const RECORD_SECTION = /戦績|戦歴/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  nbsp: " ",
  quot: '"',
  apos: "'",
};

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) =>
      NAMED_ENTITIES[name.toLowerCase()] ?? entity,
    );
}

function plainText(value: string): string {
  return decodeHtml(
    value
      // 脚注番号が本文と混ざるため、タグを外す前に落とす。
      .replace(/<sup[\s\S]*?<\/sup>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, " ")
      // セル内はリンクで語が分かれているだけなので、タグは空へ詰めて元の表記に戻す。
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

interface WikipediaPage {
  title: string;
  html: string;
}

async function requestJson<T>(
  params: Record<string, string>,
): Promise<T | undefined> {
  const query = new URLSearchParams({
    format: "json",
    formatversion: "2",
    ...params,
  });
  try {
    const response = await fetch(`${WIKIPEDIA_API}?${query.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

async function fetchPage(title: string): Promise<WikipediaPage | undefined> {
  const body = await requestJson<{
    parse?: { title: string; text: string };
  }>({ action: "parse", page: title, prop: "text", redirects: "1" });
  if (!body?.parse?.text) return undefined;
  return { title: body.parse.title, html: body.parse.text };
}

async function searchTitles(query: string): Promise<string[]> {
  const body = await requestJson<{
    query?: { search?: Array<{ title: string }> };
  }>({ action: "query", list: "search", srsearch: query, srlimit: "5" });
  return body?.query?.search?.map((item) => item.title) ?? [];
}

/** 「山中竜也 (ボクサー)」のような曖昧さ回避付きの記事名だけを受け入れる。 */
function titleMatchesFighter(title: string, fighter: string): boolean {
  const normalizedTitle = normalizeFighterName(title);
  const normalizedFighter = normalizeFighterName(fighter);
  if (!normalizedFighter) return false;
  if (normalizedTitle === normalizedFighter) return true;
  if (!normalizedTitle.startsWith(normalizedFighter)) return false;
  const suffix = normalizedTitle.slice(normalizedFighter.length);
  return /^(ボクサー|プロボクサー|ボクシング|ボクシング選手)$/.test(suffix);
}

interface Heading {
  level: number;
  title: string;
  headingStart: number;
  contentStart: number;
}

function headings(html: string): Heading[] {
  return [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)].map((match) => ({
    level: Number(match[1]),
    title: plainText(match[2]),
    headingStart: match.index ?? 0,
    contentStart: (match.index ?? 0) + match[0].length,
  }));
}

function wikitables(html: string): string[] {
  return [...html.matchAll(/<table[^>]*class="[^"]*wikitable[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .filter((table) => /勝敗|結果/.test(table) && /対戦相手|相手/.test(table));
}

/** 「戦績」節にあるプロボクシングの戦績表だけを取り出す。 */
function recordTables(html: string): string[] {
  const marks = headings(html);
  const tables: string[] = [];
  let inRecordSection = false;
  let allowedSubsection = true;

  marks.forEach((heading, index) => {
    if (heading.level <= 2) {
      inRecordSection =
        RECORD_SECTION.test(heading.title) &&
        !EXCLUDED_SECTION.test(heading.title);
      allowedSubsection = true;
    } else if (inRecordSection) {
      allowedSubsection = !EXCLUDED_SECTION.test(heading.title);
    }
    if (!inRecordSection || !allowedSubsection) return;

    const end = marks[index + 1]?.headingStart ?? html.length;
    tables.push(...wikitables(html.slice(heading.contentStart, end)));
  });

  if (tables.length > 0) return tables;

  // 節見出しの構成が異なる記事でも、戦績表が1つだけなら取り違えようがない。
  const fallback = wikitables(html);
  return fallback.length === 1 ? fallback : [];
}

function parseDate(value: string): string | undefined {
  const matched = value
    .normalize("NFKC")
    .match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!matched) return undefined;
  const [, year, month, day] = matched;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseResult(value: string): BoutResult {
  const text = value.normalize("NFKC").trim();
  if (/無効|ノーコンテスト|N\.?C\.?/i.test(text)) return "no-contest";
  if (/中止/.test(text)) return "cancelled";
  if (/^[☆○◯〇◎]/.test(text)) return "win";
  if (/^[★●]/.test(text)) return "loss";
  if (/^[△▲]/.test(text)) return "draw";
  if (/^[×✕✖x]/i.test(text)) return "loss";
  // 「-」や空欄は試合前。開催済みの日付なら結果未取得として扱われる。
  return "scheduled";
}

function cleanCell(value: string): string {
  const text = plainText(value);
  return /^[-–—]$/.test(text) ? "" : text;
}

/** 「佐野友樹（松田）」から名前とジムを分ける。「（英語版）」などの注記は落とす。 */
function parseOpponent(value: string): { name: string; gym?: string } {
  const text = cleanCell(value)
    .replace(/[（(](?:英語版|日本語版|ボクサー|ボクシング)[)）]/g, "")
    .trim();
  const matched = text.match(/^(.+?)\s*[（(]([^（()）]+)[)）]\s*$/);
  if (!matched) return { name: text };
  return { name: matched[1].trim(), gym: matched[2].trim() };
}

// 長い階級名を先に並べ、「スーパーフライ級」を「フライ級」と取り違えないようにする。
const WEIGHT_PATTERN =
  /(?:ミニマム|ライトフライ|スーパーフライ|フライ|スーパーバンタム|バンタム|スーパーフェザー|フェザー|スーパーライト|ライトヘビー|ライト|スーパーウェルター|ウェルター|スーパーミドル|ミドル|クルーザー|ヘビー)級/;

function weightClassFromText(value: string): string | undefined {
  return value.normalize("NFKC").match(WEIGHT_PATTERN)?.[0];
}

function headerCells(table: string): string[] {
  const firstRow = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i)?.[1] ?? "";
  return [...firstRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((match) =>
    plainText(match[1]),
  );
}

function parseRecordTable(table: string): FighterRecordBout[] {
  const headers = headerCells(table);
  const indexOf = (pattern: RegExp) =>
    headers.findIndex((header) => pattern.test(header));

  const dateIndex = indexOf(/日付|試合日/);
  const resultIndex = indexOf(/勝敗|結果/);
  const opponentIndex = indexOf(/対戦相手|相手/);
  if (dateIndex < 0 || resultIndex < 0 || opponentIndex < 0) return [];

  const orderIndex = indexOf(/^戦$|試合数|通算/);
  const timeIndex = indexOf(/時間|ラウンド/);
  const methodIndex = indexOf(/内容|決着|方式/);
  const countryIndex = indexOf(/国籍/);
  const notesIndex = indexOf(/備考/);
  const required = Math.max(dateIndex, resultIndex, opponentIndex);

  const bouts: FighterRecordBout[] = [];
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(1);

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (cell) => cell[1],
    );
    if (cells.length <= required) continue;

    const date = parseDate(plainText(cells[dateIndex]));
    if (!date) continue;

    const opponent = parseOpponent(cells[opponentIndex]);
    if (!opponent.name) continue;

    const notes = notesIndex >= 0 ? cleanCell(cells[notesIndex] ?? "") : "";
    const method = methodIndex >= 0 ? cleanCell(cells[methodIndex] ?? "") : "";
    const time = timeIndex >= 0 ? cleanCell(cells[timeIndex] ?? "") : "";
    const country = countryIndex >= 0 ? cleanCell(cells[countryIndex] ?? "") : "";
    const order =
      orderIndex >= 0
        ? Number.parseInt(plainText(cells[orderIndex] ?? ""), 10)
        : Number.NaN;

    bouts.push({
      order: Number.isFinite(order) ? order : bouts.length + 1,
      date,
      result: parseResult(plainText(cells[resultIndex])),
      method: [method, time].filter(Boolean).join(" ") || undefined,
      opponent: opponent.name,
      opponentGym: opponent.gym,
      opponentCountry: /日本/.test(country) ? undefined : normalizeCountry(country),
      weightClass: weightClassFromText(notes),
      notes: notes || undefined,
    });
  }

  return bouts;
}

function recordFromPage(
  page: WikipediaPage,
  fighter: string,
): WikipediaFighterRecord | undefined {
  if (!/ボクサー|ボクシング/.test(page.html)) return undefined;

  const bouts = recordTables(page.html).flatMap(parseRecordTable);
  if (bouts.length === 0) return undefined;

  // 同じ試合が複数の表に載っている記事があるため、日付と相手で1件にまとめる。
  const unique = new Map<string, FighterRecordBout>();
  for (const bout of bouts) {
    unique.set(`${bout.date}:${normalizeFighterName(bout.opponent)}`, bout);
  }

  return {
    fighter,
    pageTitle: page.title,
    pageUrl: `${WIKIPEDIA_PAGE}${encodeURIComponent(
      page.title.replace(/ /g, "_"),
    )}`,
    bouts: [...unique.values()].sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
  };
}

async function loadWikipediaFighterRecord(
  fighter: string,
): Promise<WikipediaFighterRecord | undefined> {
  const name = fighter.trim();
  if (!name || name === "未定") return undefined;

  // 本アプリの選手名は「井上 尚弥」のように姓名が分かれている。
  // Wikipediaの記事名は続けて書くため、詰めた表記も直接あたる。
  const compact = name.replace(/[\s　]+/g, "");
  const tried = new Set<string>();
  let directTitle: string | undefined;

  for (const title of compact === name ? [name] : [name, compact]) {
    tried.add(title);
    const page = await fetchPage(title);
    if (!page) continue;
    directTitle = page.title;
    const record = recordFromPage(page, name);
    if (record) return record;
  }

  // 同名の別人を拾わないよう、記事名が選手名と一致する候補だけを追加で調べる。
  const candidates = (await searchTitles(`${compact} ボクシング`))
    .filter(
      (title) =>
        title !== directTitle &&
        !tried.has(title) &&
        titleMatchesFighter(title, name),
    )
    .slice(0, MAX_SEARCH_CANDIDATES);

  for (const title of candidates) {
    const page = await fetchPage(title);
    if (!page) continue;
    const record = recordFromPage(page, name);
    if (record) return record;
  }

  return undefined;
}

const getCachedWikipediaFighterRecord = unstable_cache(
  loadWikipediaFighterRecord,
  ["signal-board-wikipedia-fighter-record-v1"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: ["boxing-fighter-record"],
  },
);

export async function fetchWikipediaFighterRecord(
  fighter: string,
): Promise<WikipediaFighterRecord | undefined> {
  return getCachedWikipediaFighterRecord(fighter);
}
