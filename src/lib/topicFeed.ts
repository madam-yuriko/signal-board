import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { unstable_cache } from "next/cache";
import { disasters } from "@/data/disasters";
import { hardware } from "@/data/hardware";
import { indieGames } from "@/data/indieGames";
import { movies } from "@/data/movies";
import { redevelopments } from "@/data/redevelopments";
import { indieGameGenresFromText } from "@/lib/indieGameGenres";
import type {
  MovieType,
  TopicBoard,
  TopicDomain,
  TopicStatusTone,
} from "@/types/topics";

const REVALIDATE_SECONDS = 60 * 60 * 24;
const FETCH_TIMEOUT_MS = 12_000;
const EIGA_ORIGIN = "https://eiga.com";
const FILMARKS_ORIGIN = "https://filmarks.com";
const MOVIE_UPCOMING_DAYS = 90;
const INDIE_GAME_MAX_ITEMS = 120;
const INDIE_GAME_RELEASE_WINDOW_YEARS = 1;
const LAST_GOOD_FEED_DIR = path.join(process.cwd(), ".signal-board-cache", "topic-feed");

interface FeedEntry {
  title: string;
  link?: string;
  description?: string;
  date?: string;
  image?: string;
  source?: string;
  platforms?: string[];
  releaseDate?: string;
  releasePlatform?: string;
  movieType?: MovieType;
  genres?: string[];
  reviewScore?: string;
  reviewCount?: string;
  genreSources?: string[];
  director?: string;
  cast?: string[];
}

export interface TopicFeed {
  items: TopicBoard[];
  mode: "live" | "fallback" | "curated";
  sourceName: string;
  updatedAt?: string;
}

const FALLBACKS: Record<TopicDomain, TopicBoard[]> = {
  hardware,
  redevelopment: redevelopments,
  movie: movies,
  "indie-game": indieGames,
  disaster: disasters,
};

const FALLBACK_IMAGES: Record<TopicDomain, string> = {
  hardware: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80",
  redevelopment: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
  movie: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1200&q=80",
  "indie-game": "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
  disaster: "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1200&q=80",
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) =>
      named[name.toLowerCase()] ?? entity,
    );
}

function plainText(value: string): string {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}

const MOVIE_GENRE_RULES: Array<[string, RegExp]> = [
  ["アクション", /アクション|action/i],
  ["ホラー", /ホラー|horror/i],
  ["スリラー", /スリラー|thriller/i],
  ["サスペンス", /サスペンス|suspense/i],
  ["パニック", /パニック|panic/i],
  ["サバイバル", /サバイバル|生き残ろう|生き延び|生き残り|survival|survive/i],
  ["犯罪", /犯罪|犯罪者|殺人|強盗|刑事|捜査|容疑者|クライム|crime|murder|detective|criminal/i],
  ["バイオレンス", /バイオレンス|暴力|殺戮|残虐|violent|violence|gore/i],
  ["SF", /\bSF\b|サイエンスフィクション|science fiction/i],
  ["ファンタジー", /ファンタジー|fantasy/i],
  ["ドラマ", /ドラマ|drama/i],
  ["コメディ", /コメディ|喜劇|comedy/i],
  ["恋愛", /恋愛|ラブストーリー|romance/i],
  ["青春", /青春|coming[- ]of[- ]age/i],
  ["アドベンチャー", /アドベンチャー|冒険|adventure/i],
  ["ミステリー", /ミステリー|mystery/i],
  ["ドキュメンタリー", /ドキュメンタリー|documentary/i],
  ["戦争", /戦争|war film/i],
  ["スポーツ", /スポーツ|sports/i],
  ["音楽", /ミュージカル|音楽|music|musical/i],
  ["歴史・伝記", /歴史|伝記|historical|biographical/i],
  ["ファミリー", /ファミリー|family/i],
];

const MOVIE_TITLE_GENRE_OVERRIDES: Array<[RegExp, string[]]> = [
  [/^オークストリートの異変$/, ["サバイバル", "SF", "ホラー"]],
  [/^名無し$/, ["犯罪", "バイオレンス", "スリラー"]],
];

const INDIE_GAME_CATEGORY_RULES: Array<[string, RegExp]> = [
  ["RPG", /RPG|ロールプレイング|role[- ]playing/i],
  ["アクション", /アクション|action|platformer|プラットフォーマー/i],
  ["アドベンチャー", /アドベンチャー|adventure|探索|謎解き/i],
  ["シミュレーション", /シミュレーション|simulation|management|経営/i],
  ["ホラー", /ホラー|horror|恐怖/i],
  ["パズル", /パズル|puzzle/i],
  ["ストラテジー", /ストラテジー|strategy|デッキ構築|deck[- ]?builder/i],
];

const FILMARKS_GENRE_MAP: Record<string, string> = {
  "アドベンチャー・冒険": "アドベンチャー",
  クライム: "犯罪",
};

function normalizeMovieTitle(value: string): string {
  return value.normalize("NFKC").replace(/[「」『』【】]/g, "").replace(/\s+/g, "").trim();
}

interface MovieSupplementalInfo {
  genres: string[];
  director?: string;
  cast: string[];
}

function filmarksMovieInfoFromHtml(html: string, title: string): MovieSupplementalInfo {
  const normalizedTitle = normalizeMovieTitle(title);
  const cards = [...html.matchAll(
    /<div class=["']p-content-cassette["']>([\s\S]*?)(?=<div class=["']p-content-cassette["']>|<\/body>)/gi,
  )].map((match) => match[1]);
  for (const card of cards) {
    const cardTitle = plainText(firstMatch(card, /<h3 class=["']p-content-cassette__title["'][^>]*>([\s\S]*?)<\/h3>/i) ?? "");
    if (normalizeMovieTitle(cardTitle) !== normalizedTitle) continue;
    const genreList = firstMatch(card, /<ul class=["']genres["'][^>]*>([\s\S]*?)<\/ul>/i) ?? "";
    const genres = [...genreList.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => plainText(match[1]))
      .map((genre) => FILMARKS_GENRE_MAP[genre] ?? genre)
      .filter(Boolean);
    let director: string | undefined;
    let cast: string[] = [];
    const peoplePattern = /<h4[^>]*class=["'][^"']*p-content-cassette__people-list-term[^"']*["'][^>]*>\s*(監督|出演者|出演)\s*<\/h4>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/gi;
    for (const peopleMatch of card.matchAll(peoplePattern)) {
      const names = [...peopleMatch[2].matchAll(/<li[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)]
        .map((match) => plainText(match[1]))
        .filter(Boolean);
      if (peopleMatch[1] === "監督") director = names[0];
      else if (peopleMatch[1] === "出演者" || peopleMatch[1] === "出演") cast = names.slice(0, 4);
    }
    return { genres: [...new Set(genres)], director, cast };
  }
  return { genres: [], cast: [] };
}

async function fetchFilmarksMovieInfo(title: string): Promise<MovieSupplementalInfo> {
  try {
    const html = await fetchText(`${FILMARKS_ORIGIN}/search/movies?q=${encodeURIComponent(title)}`);
    return filmarksMovieInfoFromHtml(html, title);
  } catch (error) {
    console.warn(`Unable to load Filmarks movie info for ${title}`, error);
    return { genres: [], cast: [] };
  }
}

function getCachedFilmarksMovieInfo(title: string): Promise<MovieSupplementalInfo> {
  return unstable_cache(
    () => fetchFilmarksMovieInfo(title),
    ["signal-board-filmarks-movie-info-v2", title],
    {
      revalidate: REVALIDATE_SECONDS,
      tags: ["movie-feed-filmarks-info"],
    },
  )();
}

function parseMovieCredits(html: string): Pick<FeedEntry, "director" | "cast"> {
  const section = html.match(/スタッフ[・／/]?(?:声優[・／/])?キャスト[\s\S]*?(?:全てのスタッフ・(?:声優・)?キャストを見る|フォトギャラリー|映画レビュー)/i)?.[0] ?? "";
  const staffList = firstMatch(section, /<dl[^>]*>([\s\S]*?)<\/dl>/i) ?? section;
  const directorBlock = firstMatch(staffList, /<dt[^>]*>\s*監督\s*<\/dt>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/i) ??
    firstMatch(staffList, /監督\s+(.+?)(?=\s+(?:製作|原作|脚本|撮影|編集|音楽|主題歌|録音|美術|衣装|キャスティング|出演|キャスト)(?:\s|$))/i);
  const directorNames = directorBlock
    ? [...directorBlock.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => plainText(match[1])).filter(Boolean)
    : [];
  const director = directorNames.length > 0
    ? [...new Set(directorNames)].join(" / ")
    : directorBlock
      ? plainText(directorBlock)
      : undefined;
  const castList = firstMatch(section, /<\/dl>([\s\S]*)/i) ??
    firstMatch(section, /<ul[^>]*>([\s\S]*?)<\/ul>/i) ?? "";
  const cast = [...castList.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => plainText(match[1]))
    .filter((value) => value.length >= 2 && !/^(Image|画像)$/i.test(value))
    .map((value) => {
      const parts = value.split(/\s+/).filter(Boolean);
      return parts[parts.length - 1] ?? value;
    })
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 6);
  return { director, cast };
}

function classifyMovie(
  title: string,
  description: string,
  html: string,
  supplementalGenres: string[] = [],
): Pick<FeedEntry, "movieType" | "genres"> {
  const detailText = plainText(html);
  const country = detailText.match(/製作[／/]\s*[^／/\n]{1,20}[／/]\s*([^\s／/、,]+)/i)?.[1] ?? "";
  const story = detailText.match(/解説・あらすじ([\s\S]*?)(?:スタッフ・キャスト|全てのスタッフ)/i)?.[1] ?? detailText.slice(0, 4_000);
  const searchable = `${title} ${description} ${country} ${story}`;
  const anime = /アニメーション|アニメ作品|劇場版アニメ|anime|animation|3d\s*cg|cg作品/i.test(searchable);
  const movieType: MovieType = anime
    ? "アニメ/CG"
    : country
      ? /日本|japan/i.test(country)
        ? "邦画"
        : "洋画"
      : /[A-Za-z]{3,}/.test(title)
        ? "洋画"
        : "邦画";
  const detectedGenres = MOVIE_GENRE_RULES
    .filter(([, pattern]) => pattern.test(searchable))
    .map(([genre]) => genre);
  const overrideGenres = MOVIE_TITLE_GENRE_OVERRIDES.find(([pattern]) => pattern.test(title))?.[1] ?? [];
  const genres = [...new Set([...detectedGenres, ...supplementalGenres, ...overrideGenres])]
    .filter((genre) => genre !== "その他");
  return {
    movieType,
    genres: genres.length > 0 ? genres : ["その他"],
  };
}

function parseFeed(xml: string): FeedEntry[] {
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)];
  return blocks.flatMap((match) => {
    const block = match[0];
    const title = plainText(firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? "");
    const description = plainText(
      firstMatch(block, /<(?:description|summary|content:encoded)[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded)>/i) ?? "",
    );
    const link = firstMatch(block, /<link[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i) ??
      firstMatch(block, /<link[^>]*>(https?:\/\/[^<]+)<\/link>/i);
    const date = firstMatch(block, /<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i);
    const image = firstMatch(block, /<(?:media:content|enclosure)[^>]*url=["']([^"']+)["']/i) ??
      firstMatch(block, /<img[^>]+src=["']([^"']+)["']/i);
    return title ? [{ title, description, link, date, image }] : [];
  });
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const japaneseDate = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/) ??
    value.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (japaneseDate) {
    const [, year, month, day] = japaneseDate;
    return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00+09:00`);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateLabel(value?: string, prefix = "更新"): string {
  const date = parseDate(value);
  if (!date) return prefix;
  return `${prefix} ${new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date)}`;
}

function updatedAt(entries: FeedEntry[]): string | undefined {
  return entries
    .map((entry) => parseDate(entry.date)?.toISOString())
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];
}

function absoluteUrl(value: string, origin: string): string {
  try {
    return new URL(value, origin).toString();
  } catch {
    return value;
  }
}

function parseIndieListing(
  html: string,
  source: string,
  origin: string,
  linkPattern: RegExp,
): FeedEntry[] {
  const entries = [...html.matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )].flatMap((match) => {
    const link = absoluteUrl(match[1], origin);
    const title = plainText(match[2]);
    if (!linkPattern.test(link) || title.length < 8 || /^(?:続きを読む|もっと見る|次のページ|前のページ)$/i.test(title)) {
      return [];
    }
    return [{ title, link, source }];
  });
  return [...new Map(entries.map((entry) => [entry.link, entry])).values()];
}

function articleContentHtml(html: string): string {
  const headingMatches = [...html.matchAll(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi)];
  const lastHeading = headingMatches[headingMatches.length - 1];
  if (lastHeading?.index !== undefined) {
    const tail = html.slice(lastHeading.index);
    const stopIndexes = [
      tail.search(/<footer\b/i),
      tail.search(/<aside\b/i),
      tail.search(/人気記事ランキング/i),
      tail.search(/最新情報をフォロー/i),
      tail.search(/ゲーム発売スケジュール/i),
      tail.search(/ゲーム発売日?スケジュール/i),
      tail.search(/関連記事/i),
      tail.search(/記事ランキング/i),
      tail.search(/特設・企画/i),
      tail.search(/お問い合わせ/i),
    ].filter((index) => index > 0);
    const end = stopIndexes.length > 0 ? Math.min(...stopIndexes) : tail.length;
    return tail.slice(0, end).replace(
      /<(header|nav|footer|aside|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
      "",
    );
  }
  const content = firstMatch(html, /<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    firstMatch(html, /<main\b[^>]*>([\s\S]*?)<\/main>/i) ??
    html;
  return content.replace(
    /<(header|nav|footer|aside|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
}

function metaContent(html: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return firstMatch(html, new RegExp(`<meta[^>]+(?:name|property)=["']${escapedKey}["'][^>]+content=["']([^"']+)["']`, "i")) ??
    firstMatch(html, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escapedKey}["']`, "i"));
}

function articleUpdatedDateFor(html: string, contentText: string): string | undefined {
  return metaContent(html, "article:modified_time") ??
    metaContent(html, "og:updated_time") ??
    metaContent(html, "dateModified") ??
    firstMatch(html, /"dateModified"\s*:\s*"([^"]+)"/i) ??
    firstMatch(html, /<time\b[^>]+datetime=["']([^"']+)["'][^>]*(?:updated|modified)[^>]*>/i) ??
    firstMatch(html, /<time\b[^>]+datetime=["']([^"']+)["']/i) ??
    firstMatch(contentText, /(\d{4}[年./-]\d{1,2}[月./-]\d{1,2}日?)/);
}

function gameTitleFor(value: string, fallback = ""): string {
  const quotedCandidates = (text: string) => [...text.matchAll(/『([^』]+)』|「([^」]+)」/g)]
    .map((match) => ({ title: match[1] ?? match[2] ?? "", index: match.index ?? 0 }))
    .filter((candidate) => candidate.title.trim().length > 0);
  const candidates = quotedCandidates(value);
  const source = candidates.length > 0 ? value : fallback;
  const sourceCandidates = candidates.length > 0 ? candidates : quotedCandidates(fallback);
  const releaseIndex = source.search(/発売|配信|リリース|ローンチ|launch|release/i);
  const sentenceStart = releaseIndex >= 0
    ? Math.max(
      source.lastIndexOf("。", releaseIndex - 1),
      source.lastIndexOf("！", releaseIndex - 1),
      source.lastIndexOf("!", releaseIndex - 1),
      source.lastIndexOf("？", releaseIndex - 1),
      source.lastIndexOf("?", releaseIndex - 1),
    ) + 1
    : 0;
  const sameSentenceBeforeRelease = releaseIndex >= 0
    ? sourceCandidates.filter((candidate) => candidate.index >= sentenceStart && candidate.index < releaseIndex)
    : [];
  const selected = sameSentenceBeforeRelease[sameSentenceBeforeRelease.length - 1] ??
    sourceCandidates[sourceCandidates.length - 1];
  return (selected?.title ?? value)
    .replace(/\s*[【\[].*?[】\]]\s*$/g, "")
    .trim();
}

function indiePlatformsFor(value: string): string[] {
  const platforms: string[] = [];
  if (/Steam|steamストア|PC\s*[（(]Steam/i.test(value)) platforms.push("Steam");
  if (/\bPS(?:5|4)\b|PlayStation|プレイステーション/i.test(value)) platforms.push("PS");
  if (/Nintendo\s+Switch|Switch\s*2|ニンテンドー(?:スイッチ|Switch)/i.test(value)) platforms.push("Switch");
  if (/Xbox|XBOX|Xbox Live|XBLIG/i.test(value)) platforms.push("XBOX");
  return [...new Set(platforms)];
}

type IndieReleaseCandidate = {
  date: Date;
  platform: string;
};

const INDIE_RELEASE_PLATFORM_PRIORITY = ["PS", "Switch", "XBOX", "Steam", "その他"] as const;

function indieReleasePlatformPriority(platform: string): number {
  const index = INDIE_RELEASE_PLATFORM_PRIORITY.indexOf(platform as typeof INDIE_RELEASE_PLATFORM_PRIORITY[number]);
  return index === -1 ? INDIE_RELEASE_PLATFORM_PRIORITY.length : index;
}

function indieReleasePlatformFor(value: string, dateIndex: number): string {
  const mentions = [
    { platform: "PS", pattern: /\bPS(?:5|4)?\b|PlayStation|プレイステーション/gi },
    { platform: "Switch", pattern: /Nintendo\s+Switch|Switch\s*2|ニンテンドー(?:スイッチ|Switch)/gi },
    { platform: "XBOX", pattern: /Xbox|XBOX|Xbox Live|XBLIG/gi },
    { platform: "Steam", pattern: /Steam|steamストア|PC\s*[（(]Steam/gi },
  ].flatMap(({ platform, pattern }) => [...value.matchAll(pattern)].map((match) => ({
    platform,
    distance: Math.abs((match.index ?? 0) - dateIndex),
  })));
  return mentions
    .filter((mention) => mention.distance <= 90)
    .sort((a, b) => a.distance - b.distance)[0]?.platform ?? "その他";
}

function indieReleaseCandidates(value: string, articleDate?: Date): IndieReleaseCandidate[] {
  const candidates: IndieReleaseCandidate[] = [];
  const addCandidate = (match: RegExpMatchArray, year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return;
    const contextStart = Math.max(0, (match.index ?? 0) - 90);
    const contextEnd = Math.min(value.length, (match.index ?? 0) + match[0].length + 90);
    const context = value.slice(contextStart, contextEnd);
    if (!/(発売|配信|リリース|販売|ローンチ|launch|release)/i.test(context)) return;
    candidates.push({
      date,
      platform: indieReleasePlatformFor(value, match.index ?? 0),
    });
  };

  for (const match of value.matchAll(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日?/g)) {
    addCandidate(match, Number(match[1]), Number(match[2]), Number(match[3]));
  }
  for (const match of value.matchAll(/(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/g)) {
    addCandidate(match, Number(match[1]), Number(match[2]), Number(match[3]));
  }
  if (articleDate) {
    for (const match of value.matchAll(/(\d{1,2})月\s*(\d{1,2})日?/g)) {
      addCandidate(match, articleDate.getFullYear(), Number(match[1]), Number(match[2]));
    }
  }
  return candidates;
}

function indieReleaseFor(value: string, articleDate?: Date): IndieReleaseCandidate | undefined {
  const now = new Date();
  const earliest = new Date(now);
  earliest.setFullYear(earliest.getFullYear() - INDIE_GAME_RELEASE_WINDOW_YEARS);
  return indieReleaseCandidates(value, articleDate)
    .filter((candidate) => candidate.date >= earliest)
    .sort((a, b) => {
      const priority = indieReleasePlatformPriority(a.platform) - indieReleasePlatformPriority(b.platform);
      if (priority !== 0) return priority;
      return a.date.getTime() - b.date.getTime();
    })[0];
}

function hasJapaneseSupport(value: string): boolean {
  return /(?:対応言語|言語|字幕|音声|テキスト|表示)[^。\n]{0,80}日本語|日本語[^。\n]{0,80}(?:対応|版|化|字幕|音声|表示|収録|テキスト)|Japanese/i.test(value);
}

function hasJapanReleaseEvidence(value: string): boolean {
  return /日本(?:国内)?[^。\n]{0,80}(?:発売|リリース|配信)(?:予定|開始|中|済み|された|されている|した)?|国内[^。\n]{0,80}(?:発売|リリース|配信)(?:予定|開始|中|済み|された|されている|した)?|(?:Steam|Switch|PS5|PS4|Xbox)[^。\n]{0,80}(?:発売|リリース|配信)(?:予定|開始|中|済み|された|されている|した)?|(?:正式)?(?:発売|リリース|配信)(?:予定|されて|済み|開始|中)|正式リリース|released/i.test(value);
}

async function fetchIndieArticle(entry: FeedEntry): Promise<FeedEntry | undefined> {
  if (!entry.link) return undefined;
  try {
    const html = await fetchText(entry.link);
    const contentHtml = articleContentHtml(html);
    const contentText = plainText(contentHtml);
    const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
      .map((match) => plainText(match[1]));
    const heading = headings[headings.length - 1] ?? entry.title;
    const title = /ファミ通\.comインディーゲーム/i.test(heading) ? entry.title : heading;
    const description = plainText(
      metaContent(html, "description") ??
      metaContent(html, "og:description") ??
      contentText.slice(0, 260),
    );
    const date = articleUpdatedDateFor(html, contentText);
    const image = metaContent(html, "og:image") ??
      firstMatch(contentHtml, /<img\b[^>]+src=["']([^"']+)["']/i);
    const displayTitle = gameTitleFor(title, contentText);
    const searchable = `${displayTitle} ${description} ${contentText}`;
    const platforms = indiePlatformsFor(searchable);
    const articleDate = parseDate(date);
    const release = indieReleaseFor(searchable, articleDate);
    const eligible = Boolean(release) && hasJapanReleaseEvidence(searchable) && hasJapaneseSupport(searchable) && platforms.length > 0;
    if (!eligible) return undefined;
    return {
      ...entry,
      title: displayTitle,
      description,
      date,
      image: image ? absoluteUrl(image, entry.link) : undefined,
      platforms,
      genres: indieGameGenresFromText(searchable, displayTitle),
      releaseDate: release?.date.toISOString(),
      releasePlatform: release?.platform,
    };
  } catch {
    return undefined;
  }
}

function imageFor(domain: TopicDomain, index: number, image?: string): string {
  return image ?? FALLBACKS[domain][index % FALLBACKS[domain].length]?.image ?? FALLBACK_IMAGES[domain];
}

function toneFor(status: string): TopicStatusTone {
  if (/警報|津波|危険|重大|噴火/i.test(status)) return "danger";
  if (/注意|監視|更新/i.test(status)) return "warning";
  return "info";
}

async function fetchText(url: string, accept = "text/html,application/xhtml+xml,application/xml") {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: accept, "User-Agent": "SignalBoard/1.0 (+public data reader)" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.ok) return response.text();
    if (response.status !== 429 || attempt === 2) {
      throw new Error(`${url} returned ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
  throw new Error(`${url} request failed`);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(values[index]);
      }
    }),
  );
  return results;
}

async function safeFetchText(url: string): Promise<string> {
  try {
    return await fetchText(url);
  } catch (error) {
    console.warn(`Unable to load movie listing page ${url}`, error);
    return "";
  }
}

async function fetchHardware(): Promise<TopicFeed> {
  const sources = [
    ["AMD", "https://newsroom.amd.com/feed/"],
    ["NVIDIA", "https://blogs.nvidia.com/blog/feed/"],
  ] as const;
  const results = await Promise.allSettled(sources.map(([, url]) => fetchText(url, "application/rss+xml,application/xml")));
  const entries = results.flatMap((result, index) =>
    result.status === "fulfilled"
      ? parseFeed(result.value).map((entry) => ({ ...entry, title: `[${sources[index][0]}] ${entry.title}` }))
      : [],
  ).slice(0, 24);
  if (entries.length === 0) throw new Error("No hardware news entries");
  const items = entries.map((entry, index): TopicBoard => {
    const category = /gpu|graphics|geforce|radeon|gaming/i.test(entry.title) ? "GPU" :
      /apu|embedded|npu|ryzen ai/i.test(entry.title) ? "APU" : "CPU";
    const source = entry.title.match(/^\[([^\]]+)\]/)?.[1] ?? "公式ニュース";
    const title = entry.title.replace(/^\[[^\]]+\]\s*/, "");
    return {
      id: `live-hardware-${index}-${entry.link ?? title}`,
      domain: "hardware",
      title,
      category,
      status: "updated",
      statusLabel: "最新更新",
      statusTone: "info",
      dateLabel: dateLabel(entry.date),
      location: `${source}公式ニュース`,
      region: source,
      summary: entry.description || `${source}の公式ニュースを取得しました。`,
      image: imageFor("hardware", index, entry.image),
      metrics: [
        { label: "発表元", value: source },
        { label: "カテゴリ", value: category },
        { label: "更新日", value: dateLabel(entry.date, "").trim() || "最新" },
        { label: "情報源", value: "公式RSS" },
      ],
      updates: [{ at: dateLabel(entry.date, "").trim() || "最新", text: entry.description || title }],
      tags: [source, category, "公式ニュース"],
    };
  });
  return { items, mode: "live", sourceName: "AMD / NVIDIA 公式RSS", updatedAt: updatedAt(entries) };
}

async function fetchRedevelopment(): Promise<TopicFeed> {
  const html = await fetchText("https://www.toshiseibi.metro.tokyo.lg.jp/information/press");
  const entries: FeedEntry[] = [...html.matchAll(/<li class="widget-information-content_info-list-date-list-item">([\s\S]*?)<\/li>/gi)].flatMap((match) => {
    const block = match[1];
    const title = firstMatch(block, /<a[^>]+class="widget-information-content_info-list-link"[^>]*>([\s\S]*?)<\/a>/i);
    const link = firstMatch(block, /<a[^>]+class="widget-information-content_info-list-link"[^>]+href="([^"]+)"/i);
    const date = firstMatch(block, /<time[^>]*>([\s\S]*?)<\/time>/i);
    return title ? [{ title: plainText(title), link, date }] : [];
  }).filter((entry) => /再開発|整備|駅|都市|建設|住宅|道路|地下化|耐震|無電柱|まち/i.test(entry.title));
  if (entries.length === 0) throw new Error("No redevelopment press entries");
  const items = entries.slice(0, 24).map((entry, index): TopicBoard => ({
    id: `live-redevelopment-${index}-${entry.link ?? entry.title}`,
    domain: "redevelopment",
    title: entry.title,
    category: "都市整備局発表",
    status: "updated",
    statusLabel: "最新更新",
    statusTone: "info",
    dateLabel: dateLabel(entry.date),
    location: "東京都",
    region: "東京",
    summary: "東京都都市整備局の報道発表から、都市整備・再開発に関係する更新を取得しました。",
    image: imageFor("redevelopment", index),
    metrics: [
      { label: "発表元", value: "東京都都市整備局" },
      { label: "更新日", value: dateLabel(entry.date, "").trim() || "最新" },
      { label: "地域", value: "東京" },
      { label: "状態", value: "公式発表" },
    ],
    updates: [{ at: dateLabel(entry.date, "").trim() || "最新", text: entry.title }],
    tags: ["東京都", "都市整備局", "公式発表"],
  }));
  return { items, mode: "live", sourceName: "東京都都市整備局 報道発表", updatedAt: updatedAt(entries) };
}

function indieCategoryFor(value: string): string {
  return INDIE_GAME_CATEGORY_RULES.find(([, pattern]) => pattern.test(value))?.[0] ?? "その他";
}

async function fetchIndieGames(): Promise<TopicFeed> {
  const sources = [
    {
      name: "ファミ通.comインディーゲーム",
      url: "https://www.famitsu.com/category/indie-game/page/1",
      origin: "https://www.famitsu.com/",
      linkPattern: /\/article\/\d{6}\/\d+\/?$/i,
    },
    {
      name: "AUTOMATON",
      url: "https://automaton-media.com/",
      origin: "https://automaton-media.com/",
      linkPattern: /\/articles\//i,
    },
    {
      name: "Indie Games Japan",
      url: "https://indiegamesjapan.com/",
      origin: "https://indiegamesjapan.com/",
      linkPattern: /\/archives\/\d{4}\/\d{2}\/\d+\/?$/i,
    },
  ] as const;
  const listingTasks: Array<{ source: string; load: () => Promise<FeedEntry[]> }> = [
    ...Array.from({ length: 8 }, (_, index) => ({
      source: sources[0].name,
      load: async () => {
        const url = index === 0
          ? sources[0].url
          : `https://www.famitsu.com/category/indie-game/page/${index + 1}`;
        const html = await fetchText(url);
        return parseIndieListing(html, sources[0].name, sources[0].origin, sources[0].linkPattern);
      },
    })),
    {
      source: sources[1].name,
      load: async () => {
        const [homepageResult, feedResult] = await Promise.allSettled([
          fetchText(sources[1].url),
          fetchText("https://automaton-media.com/feed/", "application/rss+xml,application/xml"),
        ]);
        return [
          ...(homepageResult.status === "fulfilled"
            ? parseIndieListing(homepageResult.value, sources[1].name, sources[1].origin, sources[1].linkPattern)
            : []),
          ...(feedResult.status === "fulfilled"
            ? parseFeed(feedResult.value).map((entry) => ({ ...entry, source: sources[1].name }))
            : []),
        ];
      },
    },
    ...Array.from({ length: 8 }, (_, index) => ({
      source: sources[1].name,
      load: async () => {
        const html = await fetchText(`https://automaton-media.com/page/${index + 2}/`);
        return parseIndieListing(html, sources[1].name, sources[1].origin, sources[1].linkPattern);
      },
    })),
    ...Array.from({ length: 16 }, (_, index) => ({
      source: sources[2].name,
      load: async () => {
        const url = index === 0
          ? sources[2].url
          : `https://indiegamesjapan.com/page/${index + 1}/`;
        const html = await fetchText(url);
        return parseIndieListing(html, sources[2].name, sources[2].origin, sources[2].linkPattern);
      },
    })),
  ];
  const listingResults = await Promise.allSettled(listingTasks.map((task) => task.load()));
  const candidates = listingResults.flatMap((result) =>
    result.status === "fulfilled"
      ? result.value
      : [],
  );
  const candidatesBySource = new Map<string, number>();
  const uniqueCandidates = [...new Map(
    candidates.filter((entry): entry is FeedEntry & { link: string } => Boolean(entry.link))
      .map((entry) => [entry.link, entry]),
  ).values()].filter((entry) => {
    const source = entry.source ?? "unknown";
    const count = candidatesBySource.get(source) ?? 0;
    if (count >= 160) return false;
    candidatesBySource.set(source, count + 1);
    return true;
  });
  const verifiedEntries = (await mapWithConcurrency(uniqueCandidates, 8, fetchIndieArticle))
    .filter((entry): entry is FeedEntry => Boolean(entry));
  const uniqueGames = [...new Map(
    verifiedEntries.map((entry) => [normalizeMovieTitle(entry.title), entry]),
  ).values()].sort((a, b) => {
    const platformPriority = indieReleasePlatformPriority(a.releasePlatform ?? "その他") - indieReleasePlatformPriority(b.releasePlatform ?? "その他");
    if (platformPriority !== 0) return platformPriority;
    return (parseDate(b.releaseDate)?.getTime() ?? 0) - (parseDate(a.releaseDate)?.getTime() ?? 0);
  }).slice(0, INDIE_GAME_MAX_ITEMS);
  if (uniqueGames.length === 0) throw new Error("No eligible indie game entries");

  const items = uniqueGames.map((entry, index): TopicBoard => {
    const searchable = `${entry.title} ${entry.description ?? ""}`;
    const category = indieCategoryFor(searchable);
    const platforms = entry.platforms ?? [];
    return {
      id: `live-indie-game-${entry.source}-${index}-${entry.link ?? entry.title}`,
      domain: "indie-game",
      sourceUrl: entry.link,
      title: entry.title,
      category,
      status: "released",
      statusLabel: "掲載",
      statusTone: "success",
      dateLabel: dateLabel(entry.releaseDate, `${entry.releasePlatform && entry.releasePlatform !== "その他" ? `${entry.releasePlatform}発売日` : "発売日"}`),
      releaseDate: entry.releaseDate,
      releasePlatform: entry.releasePlatform,
      articleUpdatedLabel: dateLabel(entry.date, "記事更新"),
      location: entry.source ?? "外部メディア",
      region: entry.source ?? "外部メディア",
      summary: entry.description || `${entry.source ?? "外部ゲームメディア"}から取得した記事です。`,
      image: imageFor("indie-game", index, entry.image),
      platforms,
      genres: entry.genres,
      metrics: [
        { label: "情報源", value: entry.source ?? "外部サイト" },
        { label: "カテゴリ", value: category },
        { label: "プラットフォーム", value: platforms.join(" / ") },
        { label: "発売日", value: dateLabel(entry.releaseDate, "").trim() || "不明" },
        { label: "発売日採用", value: entry.releasePlatform ?? "その他" },
        { label: "記事更新", value: dateLabel(entry.date, "").trim() || "不明" },
        { label: "対応言語", value: "日本語あり" },
      ],
      updates: [{ at: dateLabel(entry.date, "").trim() || "最新", text: entry.description || entry.title }],
      tags: [entry.source ?? "外部サイト", ...platforms, category],
    };
  });
  const activeSources = [...new Set(listingTasks
    .filter((_, index) => listingResults[index].status === "fulfilled")
    .map(({ source }) => source))]
    .join(" / ");
  const eligibleSources = [...new Set(uniqueGames.map((entry) => entry.source).filter((value): value is string => Boolean(value)))].join(" / ");
  return {
    items,
    mode: "live",
    sourceName: `取得対象: ${activeSources || "指定インディーゲームサイト"} / 条件適合カード: ${eligibleSources || "なし"}`,
    updatedAt: updatedAt(uniqueGames),
  };
}

function movieUrls(indexHtml: string): string[] {
  const listedUrls = [...indexHtml.matchAll(
    /class=["']list-block\s+list-block2["'][\s\S]{0,1800}?href=["'](?:https?:\/\/eiga\.com)?(\/movie\/\d+\/)/gi,
  )].map((match) => `${EIGA_ORIGIN}${match[1]}`);
  const urls = listedUrls.length > 0
    ? listedUrls
    : [...indexHtml.matchAll(/(?:https?:\/\/eiga\.com)?(\/movie\/\d+\/)/gi)]
      .map((match) => `${EIGA_ORIGIN}${match[1]}`);
  return [...new Set(urls)];
}

function nowMoviePageUrls(indexHtml: string): string[] {
  const pages = [...indexHtml.matchAll(/href=["'](\/now\/all\/release\/\d+\/)["']/gi)]
    .map((match) => `${EIGA_ORIGIN}${match[1]}`);
  return [...new Set([`${EIGA_ORIGIN}/now/`, ...pages])];
}

function comingMoviePageUrls(indexHtml: string): string[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + MOVIE_UPCOMING_DAYS);
  const minMonth = today.getFullYear() * 12 + today.getMonth();
  const maxMonth = cutoff.getFullYear() * 12 + cutoff.getMonth();
  const pages = [...indexHtml.matchAll(/href=["'](\/coming\/(\d{4})(\d{2})\/)["']/gi)]
    .filter((match) => {
      const month = Number(match[2]) * 12 + Number(match[3]) - 1;
      return Number(match[3]) <= 12 && month >= minMonth && month <= maxMonth;
    })
    .map((match) => `${EIGA_ORIGIN}${match[1]}`);
  return [...new Set([`${EIGA_ORIGIN}/coming/`, ...pages])];
}

async function fetchMovieDetails(url: string, status: "screening" | "upcoming"): Promise<FeedEntry | undefined> {
  try {
    const html = await fetchText(url);
    const title = firstMatch(html, /<h1 class="page-title">([\s\S]*?)<\/h1>/i);
    if (!title) return undefined;
    const cleanTitle = plainText(title);
    const description = plainText(firstMatch(html, /<meta name="description" content="([^"]+)"/i) ?? "");
    const baselineClassification = classifyMovie(cleanTitle, description, html);
    const eigaCredits = parseMovieCredits(html);
    const needsSupplement = (baselineClassification.genres?.length ?? 0) <= 1 ||
      MOVIE_TITLE_GENRE_OVERRIDES.some(([pattern]) => pattern.test(cleanTitle)) ||
      !eigaCredits.director || (eigaCredits.cast?.length ?? 0) === 0;
    const supplementalInfo = needsSupplement
      ? await getCachedFilmarksMovieInfo(cleanTitle)
      : { genres: [], cast: [] };
    const supplementalGenres = supplementalInfo.genres;
    const classification = classifyMovie(cleanTitle, description, html, supplementalGenres);
    const reviewSummary = html.match(/([0-5](?:\.[0-9])?)\s*全\s*([\d,]+)件/i);
    const reviewScore = firstMatch(html, /class=["']review-average["'][\s\S]*?class=["']rating-star[^"']*["'][^>]*>([0-9]+(?:\.[0-9]+)?)/i) ??
      reviewSummary?.[1];
    const reviewCount = firstMatch(html, /class=["']total-number["'][^>]*>\s*全\s*([\d,]+)件/i) ??
      reviewSummary?.[2] ??
      firstMatch(html, /全\s*([\d,]+)件/i);
    return {
      title: cleanTitle,
      link: url,
      description,
      date:
        firstMatch(html, /class=["']date-published["'][^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/i) ??
        firstMatch(html, /<p[^>]+class=["']data["'][^>]*>[\s\S]*?劇場公開日[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/i),
      image: firstMatch(html, /<div class="hero-img">[\s\S]*?<img[^>]+src="([^"]+)"/i),
      status,
      reviewScore,
      reviewCount,
      director: eigaCredits.director ?? supplementalInfo.director,
      cast: eigaCredits.cast?.length ? eigaCredits.cast : supplementalInfo.cast,
      genreSources: supplementalGenres.length > 0 ? ["映画.com", "Filmarks"] : ["映画.com"],
      ...classification,
    } as FeedEntry & { status: "screening" | "upcoming" };
  } catch {
    return undefined;
  }
}

function getCachedMovieDetails(
  url: string,
  status: "screening" | "upcoming",
): Promise<FeedEntry | undefined> {
  return unstable_cache(
    () => fetchMovieDetails(url, status),
    ["signal-board-movie-detail-v10-cast-names", status, url],
    {
      revalidate: REVALIDATE_SECONDS,
      tags: ["movie-feed-details"],
    },
  )();
}

async function fetchMovies(): Promise<TopicFeed> {
  const nowIndex = await fetchText(`${EIGA_ORIGIN}/now/`);
  const comingIndex = await safeFetchText(`${EIGA_ORIGIN}/coming/`);
  const nowPageUrls = nowMoviePageUrls(nowIndex);
  const nowPages = await mapWithConcurrency(
    nowPageUrls.slice(1),
    2,
    safeFetchText,
  );
  const comingPageUrls = comingIndex ? comingMoviePageUrls(comingIndex) : [];
  const comingPages = comingIndex
    ? await mapWithConcurrency(comingPageUrls.slice(1), 2, safeFetchText)
    : [];
  const urls = [
    ...[nowIndex, ...nowPages].flatMap(movieUrls).map((url) => ({ url, status: "screening" as const })),
    ...[comingIndex, ...comingPages].flatMap(movieUrls).map((url) => ({ url, status: "upcoming" as const })),
  ].filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index);
  const details = (await mapWithConcurrency(urls, 6, (item) => getCachedMovieDetails(item.url, item.status))).filter(
    (entry): entry is FeedEntry & { status: "screening" | "upcoming" } => Boolean(entry),
  ).filter((entry) => {
    if (entry.status === "screening") return true;
    const releaseDate = parseDate(entry.date);
    if (!releaseDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + MOVIE_UPCOMING_DAYS);
    return releaseDate >= today && releaseDate <= cutoff;
  });
  if (details.length === 0) throw new Error("No movie entries");
  const items = details.map((entry, index): TopicBoard => ({
    id: `live-movie-${entry.link ?? index}`,
    domain: "movie",
    sourceUrl: entry.link,
    title: entry.title,
    category: entry.genres?.[0] ?? "その他",
    status: entry.status,
    statusLabel: entry.status === "screening" ? "劇場公開中" : "公開予定",
    statusTone: entry.status === "screening" ? "info" : "warning",
    dateLabel: dateLabel(entry.date, entry.status === "screening" ? "公開" : "公開予定"),
    location: "全国劇場",
    region: "全国",
    summary: entry.description || "映画.comの作品情報から取得しました。",
    image: imageFor("movie", index, entry.image),
    metrics: [
      { label: "公開日", value: dateLabel(entry.date, "").trim() || "未定" },
      { label: "状態", value: entry.status === "screening" ? "上映中" : "公開予定" },
      { label: "地域", value: "全国" },
      {
        label: "情報源",
        value: entry.genreSources?.includes("Filmarks") ? "映画.com + Filmarks（補完）" : "映画.com",
      },
      { label: "レビュー", value: entry.reviewScore ? `${entry.reviewScore} / 5` : "未評価" },
      { label: "口コミ数", value: entry.reviewCount ? `${entry.reviewCount}件` : "0件" },
      { label: "監督", value: entry.director || "掲載なし" },
      { label: "メインキャスト", value: entry.cast?.length ? entry.cast.join("\n") : "掲載なし" },
    ],
    updates: [{ at: dateLabel(entry.date, "").trim() || "最新", text: "映画.comの作品情報を更新" }],
    tags: [
      "映画.com",
      ...(entry.genreSources?.includes("Filmarks") ? ["Filmarks（ジャンル補完）"] : []),
      entry.status === "screening" ? "上映中" : "公開予定",
      ...(entry.genres ?? []),
    ],
    movieType: entry.movieType,
    genres: entry.genres,
  }));
  return { items, mode: "live", sourceName: "映画.com 上映中・公開予定", updatedAt: new Date().toISOString() };
}

async function fetchDisasters(): Promise<TopicFeed> {
  const xml = await fetchText("https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml", "application/atom+xml,application/xml");
  const entries: FeedEntry[] = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].flatMap((match) => {
    const block = match[1];
    const title = plainText(firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? "");
    const date = firstMatch(block, /<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const link = firstMatch(block, /<link[^>]+href=["']([^"']+)["']/i);
    return title ? [{ title, date, link }] : [];
  });
  if (entries.length === 0) throw new Error("No JMA disaster entries");
  const items = entries.slice(0, 20).map((entry, index): TopicBoard => {
    const category = /火山|噴火/i.test(entry.title) ? "火山" : /津波/i.test(entry.title) ? "津波" : "地震";
    const statusLabel = /警報|津波|噴火/i.test(entry.title) ? "警戒" : "情報更新";
    return {
      id: `live-disaster-${index}-${entry.link ?? entry.title}`,
      domain: "disaster",
      title: entry.title,
      category,
      status: "monitoring",
      statusLabel,
      statusTone: toneFor(entry.title),
      dateLabel: dateLabel(entry.date),
      location: "気象庁防災情報",
      region: "全国",
      summary: "気象庁の地震・火山防災情報XMLフィードから取得した最新電文です。",
      image: imageFor("disaster", index),
      metrics: [
        { label: "情報種別", value: category },
        { label: "発表", value: dateLabel(entry.date, "").trim() || "最新" },
        { label: "対象", value: "全国" },
        { label: "情報源", value: "気象庁XML" },
      ],
      updates: [{ at: dateLabel(entry.date, "").trim() || "最新", text: entry.title }],
      tags: ["気象庁", category, "防災情報XML"],
    };
  });
  return { items, mode: "live", sourceName: "気象庁 地震火山情報XML", updatedAt: updatedAt(entries) };
}

async function buildTopicFeed(domain: TopicDomain): Promise<TopicFeed> {
  if (domain === "hardware") return fetchHardware();
  if (domain === "redevelopment") return fetchRedevelopment();
  if (domain === "movie") return fetchMovies();
  if (domain === "indie-game") return fetchIndieGames();
  return fetchDisasters();
}

const getCachedTopicFeed = unstable_cache(
  async (domain: TopicDomain) => buildTopicFeed(domain),
  ["signal-board-topic-feed-v33-release-window-120-genres"],
  { revalidate: REVALIDATE_SECONDS, tags: ["topic-feed"] },
);

const LEGACY_TOPIC_FEED_CACHE_KEYS = [
  "signal-board-topic-feed-v19-credits-published-label",
  "signal-board-topic-feed-v18-credits-cast-area",
  "signal-board-topic-feed-v17-credits-anime-heading",
  "signal-board-topic-feed-v16-credits-dl-ul",
  "signal-board-topic-feed-v15-persistent-snapshot",
  "signal-board-topic-feed-v14-credits",
  "signal-board-topic-feed-v13-review-count-parser",
  "signal-board-topic-feed-v12-thriller-genre",
  "signal-board-topic-feed-v11-sf-horror-split",
  "signal-board-topic-feed-v10-filmarks-genres",
  "signal-board-topic-feed-v9-movie-review-metrics",
  "signal-board-topic-feed-v8-differential-movie-details",
] as const;

function getLegacyCachedTopicFeed(cacheKey: string) {
  return unstable_cache(
    async (domain: TopicDomain) => buildTopicFeed(domain),
    [cacheKey],
    { revalidate: REVALIDATE_SECONDS, tags: ["topic-feed"] },
  );
}

async function readLastGoodFeed(domain: TopicDomain): Promise<TopicFeed | undefined> {
  try {
    const value = await fs.readFile(path.join(LAST_GOOD_FEED_DIR, `${domain}.json`), "utf8");
    const feed = JSON.parse(value) as TopicFeed;
    if (feed.mode !== "live" || !Array.isArray(feed.items) || feed.items.length === 0) return undefined;
    if (domain === "indie-game" && feed.items.some((item) => !item.releaseDate || !Array.isArray(item.genres))) return undefined;
    return feed;
  } catch {
    return undefined;
  }
}

async function writeLastGoodFeed(domain: TopicDomain, feed: TopicFeed): Promise<void> {
  if (feed.mode !== "live" || feed.items.length === 0) return;
  try {
    await fs.mkdir(LAST_GOOD_FEED_DIR, { recursive: true });
    const target = path.join(LAST_GOOD_FEED_DIR, `${domain}.json`);
    const temporary = `${target}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(feed), "utf8");
    await fs.rename(temporary, target);
  } catch {
    // The deployment filesystem may be read-only; the Next data cache still remains available.
  }
}

export async function getTopicFeed(domain: TopicDomain): Promise<TopicFeed> {
  try {
    const feed = await getCachedTopicFeed(domain);
    await writeLastGoodFeed(domain, feed);
    return feed;
  } catch (error) {
    console.warn(`Unable to load live ${domain} feed`, error);
    const persistedFeed = await readLastGoodFeed(domain);
    if (persistedFeed) {
      console.warn(`Using last good ${domain} feed snapshot`);
      return persistedFeed;
    }
    for (const cacheKey of LEGACY_TOPIC_FEED_CACHE_KEYS) {
      try {
        const staleFeed = await getLegacyCachedTopicFeed(cacheKey)(domain);
        if (staleFeed.mode === "live" && staleFeed.items.length > 0 &&
          (domain !== "indie-game" || staleFeed.items.every((item) => Boolean(item.releaseDate) && Array.isArray(item.genres)))) {
          console.warn(`Using stale ${domain} feed cache ${cacheKey}`);
          return staleFeed;
        }
      } catch {
        // Try the next legacy cache before falling back to saved data.
      }
    }
    return {
      // The indie-game tab has a strict evidence requirement. Do not show the
      // old illustrative entries when all three requested sources are down.
      items: domain === "indie-game" ? [] : FALLBACKS[domain],
      mode: "fallback",
      sourceName: domain === "indie-game" ? "指定サイトから取得できませんでした" : "保存データ",
    };
  }
}
