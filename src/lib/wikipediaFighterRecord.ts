import "server-only";

import { unstable_cache } from "next/cache";
import { normalizeCountry, normalizeFighterName } from "@/lib/fighterInfo";
import type { FighterProfile } from "@/lib/fighterProfile";
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
const BULK_TITLE_BATCH_SIZE = 50;
const BULK_PROFILE_BATCH_SIZE = 10;
// WikimediaのAPI制限にかからないよう、一覧確認は最大60リクエスト/分に抑える。
const BULK_REQUEST_DELAY_MS = 1_000;
const WIKIPEDIA_MIN_REQUEST_INTERVAL_MS = 1_500;

let wikipediaRequestQueue = Promise.resolve();
let wikipediaLastRequestAt = 0;

// プロボクシング以外の戦績表（エキシビション、キック、MMA、アマチュア）は使わない。
const EXCLUDED_SECTION =
  /エキシビ|アマチュア|キック|総合格闘技|ミックス|ムエタイ|空手|MMA/i;
const RECORD_SECTION = /戦績|戦歴/;
const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export type WikipediaFighterProfile = Omit<
  FighterProfile,
  "fighterKey" | "updatedAt"
>;

export interface WikipediaFighterLookup {
  record?: WikipediaFighterRecord;
  profile?: WikipediaFighterProfile;
  /** 判定に使ったWikipedia記事のURL。プロフィール項目が空でも保持する。 */
  wikipediaUrl?: string;
}

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

async function waitForWikipediaRequestSlot(): Promise<void> {
  let release!: () => void;
  const previous = wikipediaRequestQueue;
  wikipediaRequestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const delay = Math.max(
    0,
    wikipediaLastRequestAt + WIKIPEDIA_MIN_REQUEST_INTERVAL_MS - Date.now(),
  );
  if (delay > 0) await wait(delay);
  wikipediaLastRequestAt = Date.now();
  release();
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await waitForWikipediaRequestSlot();
      const response = await fetch(`${WIKIPEDIA_API}?${query.toString()}`, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        next: { revalidate: REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status === 429 || response.status === 503) {
        if (attempt < 2) {
          const retryAfterSeconds = Number(response.headers.get("retry-after"));
          const retryDelay = Number.isFinite(retryAfterSeconds)
            ? Math.max(5_000, retryAfterSeconds * 1_000)
            : 10_000 * (attempt + 1);
          await wait(retryDelay);
        }
        continue;
      }
      if (!response.ok) return undefined;
      return (await response.json()) as T;
    } catch {
      if (attempt < 2) await wait(2_000 * (attempt + 1));
    }
  }
  return undefined;
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

interface WikipediaTitlePage {
  title: string;
  missing?: boolean;
  pageprops?: { disambiguation?: string };
}

interface WikipediaPageContent {
  title: string;
  revisions?: Array<{
    slots?: { main?: { content?: string } };
  }>;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function queryWikipediaTitles(titles: string[]): Promise<WikipediaTitlePage[]> {
  const body = await requestJson<{
    query?: { pages?: WikipediaTitlePage[] };
  }>({
    action: "query",
    prop: "info|pageprops",
    ppprop: "disambiguation",
    redirects: "1",
    titles: titles.join("|"),
  });
  if (!body?.query?.pages) {
    throw new Error("Wikipediaのページ確認に失敗しました。");
  }
  return body.query.pages;
}

async function queryWikipediaPageContents(
  titles: string[],
): Promise<WikipediaPageContent[]> {
  const body = await requestJson<{
    query?: { pages?: WikipediaPageContent[] };
  }>({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    rvsection: "0",
    titles: titles.join("|"),
  });
  if (!body?.query?.pages) {
    throw new Error("Wikipediaプロフィールの取得に失敗しました。");
  }
  return body.query.pages;
}

function bulkTitleCandidates(name: string): string[] {
  const compact = name.replace(/[\s　]+/g, "");
  return compact === name ? [name] : [name, compact];
}

function wikiValueText(value: string): string {
  return plainText(
    value
      .replace(/<ref[\s\S]*?<\/ref>/gi, "")
      .replace(/<ref[^>]*\/>/gi, "")
      .replace(/\{\{[^{}]*\}\}/g, "")
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1"),
  );
}

function wikitextInfoboxValue(
  wikitext: string,
  label: RegExp,
): string | undefined {
  for (const line of wikitext.split(/\r?\n/).slice(0, 120)) {
    const match = line.match(/^\s*\|\s*([^=]+?)\s*=\s*(.*)$/);
    if (match && label.test(match[1].trim())) return match[2].trim();
  }
  return undefined;
}

function profileFromWikitext(
  title: string,
  fighter: string,
  wikitext: string,
): WikipediaFighterProfile {
  const birthValue = wikitextInfoboxValue(
    wikitext,
    /^(?:生年月日|誕生日|birth_date|birthdate|dateofbirth)$/i,
  );
  const birthTemplate = birthValue?.match(
    /\{\{[^|}]+\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/,
  );
  const birthDate = birthTemplate
    ? `${birthTemplate[1]}-${birthTemplate[2].padStart(2, "0")}-${birthTemplate[3].padStart(2, "0")}`
    : birthDateFromText(wikiValueText(birthValue ?? ""));
  const stanceValue = wikitextInfoboxValue(
    wikitext,
    /^(?:構え|スタイル|stance|style)$/i,
  );
  const stance = stanceValue?.includes("サウスポー")
    ? "サウスポー"
    : stanceValue?.includes("オーソドックス")
      ? "オーソドックス"
      : undefined;
  const birthplacePrefecture = prefectureFromText(
    wikiValueText(
      wikitextInfoboxValue(
        wikitext,
        /^(?:出身地|出生地|birth_place|birthplace|placeofbirth)$/i,
      ) ?? "",
    ),
  );
  return {
    fighterName: fighter,
    birthDate,
    stance,
    birthplacePrefecture,
    sourceUrl: `${WIKIPEDIA_PAGE}${encodeURIComponent(title.replace(/ /g, "_"))}`,
  };
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

function infoboxValue(html: string, label: RegExp): string | undefined {
  const tables = [...html.matchAll(
    /<table[^>]*class="[^"]*infobox[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
  )];
  for (const table of tables) {
    const rows = [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
      const heading = row[1].match(/<th[^>]*>([\s\S]*?)<\/th>/i)?.[1];
      const value = row[1].match(/<td[^>]*>([\s\S]*?)<\/td>/i)?.[1];
      if (!heading || !value || !label.test(plainText(heading))) continue;
      return plainText(value);
    }
  }
  return undefined;
}

function birthDateFromText(value?: string): string | undefined {
  if (!value) return undefined;
  return (
    parseDate(value) ??
    value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)?.slice(1).join("-")
  );
}

function prefectureFromText(value?: string): string | undefined {
  if (!value) return undefined;
  return PREFECTURES.find((prefecture) => value.includes(prefecture));
}

function profileFromPage(
  page: WikipediaPage,
  fighter: string,
): WikipediaFighterProfile {
  const birthDate = birthDateFromText(infoboxValue(page.html, /生年月日|誕生日/));
  const stanceValue = infoboxValue(page.html, /構え|スタイル/);
  const stance = stanceValue?.includes("サウスポー")
    ? "サウスポー"
    : stanceValue?.includes("オーソドックス")
      ? "オーソドックス"
      : undefined;
  const birthplacePrefecture = prefectureFromText(
    infoboxValue(page.html, /出身地|出生地/),
  );
  return {
    fighterName: fighter,
    birthDate,
    stance,
    birthplacePrefecture,
    sourceUrl: `${WIKIPEDIA_PAGE}${encodeURIComponent(
      page.title.replace(/ /g, "_"),
    )}`,
  };
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

function lookupFromPage(
  page: WikipediaPage,
  fighter: string,
): WikipediaFighterLookup | undefined {
  if (!/ボクサー|ボクシング/.test(page.html)) return undefined;
  const record = recordFromPage(page, fighter);
  const profile = profileFromPage(page, fighter);
  return { record, profile, wikipediaUrl: profile.sourceUrl };
}

async function loadWikipediaFighterLookup(
  fighter: string,
): Promise<WikipediaFighterLookup | undefined> {
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
    const lookup = lookupFromPage(page, name);
    if (lookup) return lookup;
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
    const lookup = lookupFromPage(page, name);
    if (lookup) return lookup;
  }

  return undefined;
}

const getCachedWikipediaFighterLookup = unstable_cache(
  loadWikipediaFighterLookup,
  ["signal-board-wikipedia-fighter-lookup-v1"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: ["boxing-fighter-record"],
  },
);

export async function fetchWikipediaFighterRecord(
  fighter: string,
): Promise<WikipediaFighterRecord | undefined> {
  return (await getCachedWikipediaFighterLookup(fighter))?.record;
}

export async function fetchWikipediaFighterLookup(
  fighter: string,
): Promise<WikipediaFighterLookup | undefined> {
  return getCachedWikipediaFighterLookup(fighter);
}

/** 選手一覧を表示するためのWikipedia有無確認。外部APIへの同時接続数を制限する。 */
export async function fetchWikipediaFighterLookups(
  fighters: string[],
): Promise<Array<{ fighterName: string; lookup?: WikipediaFighterLookup }>> {
  const unique = [
    ...new Map(
      fighters
        .map((fighter) => fighter.trim())
        .filter(Boolean)
        .map((fighter) => [normalizeFighterName(fighter), fighter] as const),
    ).values(),
  ];
  const results: Array<{
    fighterName: string;
    lookup?: WikipediaFighterLookup;
  }> = [];
  let nextIndex = 0;
  const workerCount = Math.min(6, unique.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < unique.length) {
        const fighterName = unique[nextIndex];
        nextIndex += 1;
        results.push({
          fighterName,
          lookup: await getCachedWikipediaFighterLookup(fighterName),
        });
      }
    }),
  );

  return results;
}

/** 選手一覧向け。記事の存在確認とプロフィール取得をまとめて行う。 */
export async function fetchWikipediaFighterUrls(
  fighters: string[],
): Promise<
  Array<{
    fighterName: string;
    wikipediaUrl?: string;
    profile?: WikipediaFighterProfile;
    record?: WikipediaFighterRecord;
  }>
> {
  const unique = [
    ...new Map(
      fighters
        .map((fighter) => fighter.trim())
        .filter(Boolean)
        .map((fighter) => [normalizeFighterName(fighter), fighter] as const),
    ).values(),
  ];
  const namesByKey = new Map(
    unique.map((fighter) => [normalizeFighterName(fighter), fighter]),
  );
  const urls = new Map<string, string>();
  const matchedPages = new Map<string, WikipediaTitlePage>();
  const profiles = new Map<string, WikipediaFighterProfile>();
  const records = new Map<string, WikipediaFighterRecord>();
  const titles = [
    ...new Set(unique.flatMap(bulkTitleCandidates)),
  ];

  for (let index = 0; index < titles.length; index += BULK_TITLE_BATCH_SIZE) {
    if (index > 0) await wait(BULK_REQUEST_DELAY_MS);
    const pages = await queryWikipediaTitles(
      titles.slice(index, index + BULK_TITLE_BATCH_SIZE),
    );
    for (const page of pages) {
      if (page.missing || page.pageprops?.disambiguation) continue;
      const fighter = namesByKey.get(normalizeFighterName(page.title));
      if (!fighter) continue;
      const key = normalizeFighterName(fighter);
      if (!matchedPages.has(key)) matchedPages.set(key, page);
      urls.set(key, `${WIKIPEDIA_PAGE}${encodeURIComponent(page.title.replace(/ /g, "_"))}`);
    }
  }

  const profilePages = [...matchedPages.values()];
  for (let index = 0; index < profilePages.length; index += BULK_PROFILE_BATCH_SIZE) {
    if (index > 0) await wait(BULK_REQUEST_DELAY_MS);
    const pages = await queryWikipediaPageContents(
      profilePages
        .slice(index, index + BULK_PROFILE_BATCH_SIZE)
        .map((page) => page.title),
    );
    for (const page of pages) {
      const fighter = namesByKey.get(normalizeFighterName(page.title));
      const content = page.revisions?.[0]?.slots?.main?.content;
      if (!fighter || !content) continue;
      profiles.set(
        normalizeFighterName(fighter),
        profileFromWikitext(page.title, fighter, content),
      );
    }
  }

  // 戦績表はHTMLの表構造を使って解析するため、記事が見つかった選手だけ本文を取得する。
  // 対象は一覧の1ページ分だけなので、Wikipediaへの負荷を抑えながら正確な戦績を使える。
  for (const page of profilePages) {
    await wait(BULK_REQUEST_DELAY_MS);
    const htmlPage = await fetchPage(page.title);
    const fighter = namesByKey.get(normalizeFighterName(page.title));
    if (!fighter || !htmlPage) continue;
    const record = recordFromPage(htmlPage, fighter);
    if (record) records.set(normalizeFighterName(fighter), record);
  }

  return unique.map((fighterName) => {
    const key = normalizeFighterName(fighterName);
    return {
      fighterName,
      wikipediaUrl: urls.get(key),
      profile: profiles.get(key),
      record: records.get(key),
    };
  });
}
