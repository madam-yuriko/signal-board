import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { unstable_cache } from "next/cache";
import { disasters } from "@/data/disasters";
import { hardware } from "@/data/hardware";
import { indieGames } from "@/data/indieGames";
import { movies } from "@/data/movies";
import { redevelopments } from "@/data/redevelopments";
import { redevelopmentSpotlights } from "@/data/redevelopmentSpotlights";
import { indieGameGenresFromText } from "@/lib/indieGameGenres";
import {
  listIndieGameTracking,
  markIndieGameTrackingChecked,
  mergeIndieGameTracking,
  type IndieGameTrackingRecord,
  type IndieGameTrackingUpdate,
} from "@/lib/indieGameTrackingDb";
import type {
  MovieType,
  TopicBoard,
  TopicDomain,
  TopicMetricLine,
  TopicPrice,
  TopicReleaseDate,
  TopicStatusTone,
} from "@/types/topics";

const REVALIDATE_SECONDS = 60 * 60 * 24;
const FEED_SOFT_TIMEOUT_MS = 8_000;
const LAST_GOOD_FEED_MAX_AGE_MS = REVALIDATE_SECONDS * 1_000;
const FETCH_TIMEOUT_MS = 12_000;
const EIGA_ORIGIN = "https://eiga.com";
const FILMARKS_ORIGIN = "https://filmarks.com";
const MOVIE_UPCOMING_DAYS = 90;
const MOVIE_FEED_CACHE_VERSION = "movie-formal-genres-v9-filmarks-review-score";
const INDIE_GAME_FEED_CACHE_VERSION = "indie-platform-release-dates-v2";
const INDIE_GAME_MAX_ITEMS = 120;
const INDIE_GAME_RELEASE_WINDOW_YEARS = 1;
const INDIE_TRACKING_RECHECK_DAYS = 30;
const INDIE_TRACKING_SEARCH_LIMIT = 24;
const TOKYO_REDEVELOPMENT_INDEX =
  "https://www.toshiseibi.metro.tokyo.lg.jp/machizukuri/shigaichi_seibi/sai-kai/saikaihatsu";
const SAPPORO_REDEVELOPMENT_INDEX =
  "https://www.city.sapporo.jp/toshi/saikaihatsu/redevelopment/jigyo/index.html";
const LAST_GOOD_FEED_DIR = path.join(process.cwd(), ".signal-board-cache", "topic-feed");

interface FeedEntry {
  title: string;
  link?: string;
  description?: string;
  date?: string;
  image?: string;
  source?: string;
  platforms?: string[];
  prices?: TopicPrice[];
  releaseDate?: string;
  releaseDates?: TopicReleaseDate[];
  releasePlatform?: string;
  trackingSources?: string[];
  movieType?: MovieType;
  genres?: string[];
  reviewScore?: string;
  reviewCount?: string;
  reviewUrl?: string;
  filmarksReviewScore?: string;
  filmarksReviewCount?: string;
  filmarksReviewUrl?: string;
  distributor?: string;
  genreSources?: string[];
  director?: string;
  cast?: string[];
}

interface RedevelopmentListEntry {
  title: string;
  location: string;
  region: "東京" | "北海道";
  area?: string;
  executor?: string;
  decisionDate?: string;
  approvalDate?: string;
  progress?: string;
  businessPeriod?: string;
  uses?: string;
  sourceUrl: string;
  category: string;
}

export interface TopicFeed {
  items: TopicBoard[];
  mode: "live" | "fallback" | "curated";
  sourceName: string;
  updatedAt?: string;
  cacheVersion?: string;
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

function htmlCells(row: string): string[] {
  return [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) =>
    plainText(match[1]).replace(/-->/g, "").trim(),
  );
}

function hrefIn(value: string, baseUrl: string): string | undefined {
  const href = firstMatch(value, /<a\b[^>]+href=["']([^"']+)["']/i);
  if (!href) return undefined;
  try {
    return new URL(decodeHtml(href), baseUrl).toString();
  } catch {
    return undefined;
  }
}

function stripLeadingDigits(value: string): string {
  return value.replace(/^[0-9０-９]+/, "").trim();
}

function isTableFor(headers: string[], required: string[]): boolean {
  const text = headers.join(" ");
  return required.every((header) => text.includes(header));
}

function parseTokyoRedevelopmentList(html: string): RedevelopmentListEntry[] {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((match) => match[1])
    .filter((table) => {
      const header = htmlCells(firstMatch(table, /(<tr\b[\s\S]*?<\/tr>)/i) ?? "");
      return isTableFor(header, ["地区名", "施行者", "進捗状況"]);
    });
  const entries: RedevelopmentListEntry[] = [];

  for (const table of tables) {
    let currentLocation = "東京都";
    const rows = [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
    for (const row of rows) {
      const cells = htmlCells(row);
      if (cells.length < 8 || cells.some((cell) => cell.includes("地区名"))) continue;

      let offset = 0;
      const firstCellLocation = stripLeadingDigits(cells[0]);
      if (cells.length >= 9 && /(区|市)$/.test(firstCellLocation)) {
        currentLocation = firstCellLocation;
        offset = 1;
      }

      const title = cells[offset + 1]
        ?.replace(/[※＊]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!title || /^地区名$/.test(title)) continue;

      const detailUrl = hrefIn(row, TOKYO_REDEVELOPMENT_INDEX);
      entries.push({
        title,
        location: currentLocation,
        region: "東京",
        area: cells[offset + 3],
        executor: cells[offset + 2],
        decisionDate: cells[offset + 4],
        approvalDate: cells[offset + 5],
        progress: cells[offset + 6],
        sourceUrl: detailUrl ?? TOKYO_REDEVELOPMENT_INDEX,
        category: "市街地再開発",
      });
    }
  }

  return entries;
}

function parseSapporoRedevelopmentList(html: string): RedevelopmentListEntry[] {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((match) => match[1])
    .filter((table) => {
      const header = htmlCells(firstMatch(table, /(<tr\b[\s\S]*?<\/tr>)/i) ?? "");
      return isTableFor(header, ["地区名", "事業年度"]);
    });
  const entries: RedevelopmentListEntry[] = [];

  for (const table of tables) {
    const headerRow = firstMatch(table, /(<tr\b[\s\S]*?<\/tr>)/i) ?? "";
    const headers = htmlCells(headerRow);
    const isActiveTable = headers.some((header) => header.includes("事業進捗状況"));
    const isPriorityBuildingTable = headers.some((header) => header.includes("タイプ"));
    const rows = [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);

    for (const row of rows) {
      const cells = htmlCells(row);
      const title = cells[0]?.replace(/\s+/g, " ").trim();
      if (cells.length < 5 || !title || title.includes("地区名")) continue;

      const progress = isActiveTable ? cells[1] : "完了";
      const addressIndex = isActiveTable ? 2 : 1;
      const executorIndex = isActiveTable ? 3 : 2;
      const periodIndex = isActiveTable ? 4 : 3;
      const usesIndex = isActiveTable ? 5 : 4;
      const uses = cells[usesIndex];
      const commercialProject = /商業|店舗|事務所|業務|ホテル|劇場|シアター|市場|バスターミナル/i.test(uses ?? "");
      if (!commercialProject) continue;

      entries.push({
        title,
        location: cells[addressIndex] ?? "札幌市",
        region: "北海道",
        executor: cells[executorIndex],
        businessPeriod: cells[periodIndex],
        progress,
        uses,
        sourceUrl: hrefIn(row, SAPPORO_REDEVELOPMENT_INDEX) ?? SAPPORO_REDEVELOPMENT_INDEX,
        category: isPriorityBuildingTable ? "優良建築物等整備" : "市街地再開発",
      });
    }
  }

  return entries;
}

function redevelopmentStatus(progress: string | undefined): {
  status: string;
  statusLabel: string;
  statusTone: TopicStatusTone;
} {
  if (/完了|竣工/.test(progress ?? "")) {
    return { status: "completed", statusLabel: "事業完了", statusTone: "success" };
  }
  if (/工事中|事業中/.test(progress ?? "")) {
    return { status: "construction", statusLabel: "事業中", statusTone: "warning" };
  }
  return { status: "planning", statusLabel: "計画中", statusTone: "neutral" };
}

function redevelopmentArea(entry: RedevelopmentListEntry): string {
  if (entry.region === "北海道") {
    return /中央区/.test(entry.location) ? "札幌中央区" : "札幌その他";
  }

  const searchable = `${entry.location} ${entry.title}`;
  if (/新宿|西新宿|歌舞伎町|大久保|高田馬場|四谷/.test(searchable)) return "新宿";
  if (/丸の内|大手町|八重洲|日本橋|有楽町|東京駅|兜町|京橋/.test(searchable)) return "丸の内・東京駅";
  if (/渋谷|恵比寿|代官山|原宿|表参道|青山|神宮前/.test(searchable)) return "渋谷";
  if (/品川|高輪|田町|芝浦|大崎|五反田/.test(searchable)) return "品川・高輪";
  return "その他東京";
}

function redevelopmentCardId(entry: RedevelopmentListEntry, index: number): string {
  const key = `${entry.region}-${entry.location}-${entry.title}`
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `live-redevelopment-${key || index}`;
}

function redevelopmentCard(entry: RedevelopmentListEntry, index: number): TopicBoard {
  const status = redevelopmentStatus(entry.progress);
  const uses = entry.uses ?? "詳細資料を参照";
  const progress = entry.progress ?? "公式一覧掲載";
  const period = entry.businessPeriod ? `事業年度 ${entry.businessPeriod}` : progress;
  const isCompleted = status.status === "completed";
  const commercialScale = /商業|店舗|事務所|業務|ホテル|劇場|シアター|市場|バスターミナル/i.test(uses)
    ? uses
    : "公表資料なし";

  return {
    id: redevelopmentCardId(entry, index),
    domain: "redevelopment",
    title: entry.title,
    category: entry.category,
    status: status.status,
    statusLabel: status.statusLabel,
    statusTone: status.statusTone,
    dateLabel: isCompleted ? `事業完了 ${progress}` : period,
    location: entry.location,
    region: entry.region,
    area: redevelopmentArea(entry),
    summary: `${entry.region}${entry.location}の公式再開発地区一覧に掲載されている案件です。${uses !== "詳細資料を参照" ? `主な用途は${uses}。` : "詳細な用途・規模は公式資料を参照してください。"}`,
    image: imageFor("redevelopment", index),
    metrics: [
      { label: "地区面積", value: entry.area ?? "公表資料なし" },
      { label: "施行者", value: entry.executor ?? "公表資料なし" },
      { label: "主な用途", value: uses },
      { label: "商業規模", value: commercialScale },
      { label: "テナント数", value: "公表資料なし" },
      ...(entry.decisionDate ? [{ label: "都市計画決定", value: entry.decisionDate }] : []),
      ...(entry.approvalDate ? [{ label: "事業計画認可", value: entry.approvalDate }] : []),
    ],
    updates: [{ at: "公式一覧", text: progress }],
    tags: [entry.region, entry.category, entry.executor ?? "施行者未公表"],
    sourceUrl: entry.sourceUrl,
  };
}

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
  reviewScore?: string;
  reviewCount?: string;
  reviewUrl?: string;
}

function normalizeFilmarksMovieUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, FILMARKS_ORIGIN);
    if (parsed.hostname !== "filmarks.com" || !/^\/movies\/\d+(?:\/reviews)?\/?$/i.test(parsed.pathname)) {
      return url;
    }
    parsed.pathname = parsed.pathname.replace(/\/reviews\/?$/i, "");
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}

function filmarksMovieInfoFromHtml(html: string, title: string): MovieSupplementalInfo {
  const normalizedTitle = normalizeMovieTitle(title);
  const cards = [...html.matchAll(
    /<div\b(?=[^>]*\bclass=["'][^"']*\bp-content-cassette\b[^"']*["'])[^>]*>([\s\S]*?)(?=<div\b(?=[^>]*\bclass=["'][^"']*\bp-content-cassette\b[^"']*["'])|<\/body>)/gi,
  )].map((match) => match[1]);
  for (const card of cards) {
    const cardTitle = plainText(firstMatch(card, /<h3 class=["']p-content-cassette__title["'][^>]*>([\s\S]*?)<\/h3>/i) ?? "");
    if (normalizeMovieTitle(cardTitle) !== normalizedTitle) continue;
    const moviePath = firstMatch(card, /<a\b[^>]+href=["']((?:https?:\/\/filmarks\.com)?\/movies\/\d+\/?)["']/i);
    const reviewUrl = moviePath
      ? new URL(moviePath, FILMARKS_ORIGIN).toString().replace(/\/+$/, "")
      : undefined;
    const cardReview = filmarksMovieReviewFromHtml(card);
    const genreList = firstMatch(card, /<ul\b[^>]*\bclass=["'][^"']*\bgenres\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i) ?? "";
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
    return {
      genres: [...new Set(genres)],
      director,
      cast,
      reviewUrl,
      ...cardReview,
    };
  }
  return { genres: [], cast: [] };
}

function filmarksMovieInfoFromJsonLd(html: string, title: string): MovieSupplementalInfo {
  const normalizedTitle = normalizeMovieTitle(title);
  const scripts = [...html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];
  const personNames = (value: unknown): string[] => {
    const people = Array.isArray(value) ? value : value ? [value] : [];
    return people.flatMap((person) => {
      if (typeof person === "string") return [person];
      if (person && typeof person === "object" && typeof (person as { name?: unknown }).name === "string") {
        return [(person as { name: string }).name];
      }
      return [];
    });
  };

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1]) as Record<string, unknown> | Array<Record<string, unknown>>;
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed["@graph"])
          ? parsed["@graph"] as Array<Record<string, unknown>>
          : [parsed];
      const movie = candidates.find((candidate) => {
        const type = candidate["@type"];
        const candidateTitle = typeof candidate.title === "string"
          ? candidate.title
          : typeof candidate.name === "string"
            ? candidate.name
            : "";
        return (type === "Movie" || (Array.isArray(type) && type.includes("Movie"))) &&
          normalizeMovieTitle(candidateTitle) === normalizedTitle;
      });
      if (!movie) continue;
      const genres = Array.isArray(movie.genres)
        ? movie.genres.filter((genre): genre is string => typeof genre === "string")
        : [];
      return {
        genres: [...new Set(genres.map((genre) => FILMARKS_GENRE_MAP[genre] ?? genre))],
        director: personNames(movie.director)[0],
        cast: personNames(movie.actor).slice(0, 6),
      };
    } catch {
      // Ignore malformed structured data and try the next JSON-LD block.
    }
  }
  return { genres: [], cast: [] };
}

function filmarksMovieReviewFromHtml(html: string): Pick<MovieSupplementalInfo, "reviewScore" | "reviewCount"> {
  const pageText = plainText(html);
  const reviewScore = firstMatch(
    html,
    /class=["'][^"']*\bc2-rating-l__text\b[^"']*["'][^>]*>\s*([0-5](?:\.[0-9]+)?)/i,
  ) ?? firstMatch(
    html,
    /class=["'][^"']*\bc-rating__score\b[^"']*["'][^>]*>\s*([0-5](?:\.[0-9]+)?)/i,
  ) ?? firstMatch(html, /["']rating["']\s*:\s*["']?([0-5](?:\.[0-9]+)?)/i);
  const reviewCount = firstMatch(
    pageText,
    /([\d,]+)\s*件(?:の)?(?:レビュー|感想・評価)/i,
  ) ?? firstMatch(
    pageText,
    /(?:レビュー|感想・評価)[^\d]{0,80}([\d,]+)\s*件/i,
  ) ?? firstMatch(
    html,
    /["'](?:reviewCount|review_count|reviewsCount)["']\s*:\s*["']?([\d,]+)/i,
  ) ?? firstMatch(
    html,
    /(?:data-review[-_]?count|review[-_]?count)=["']([\d,]+)["']/i,
  );
  return { reviewScore, reviewCount };
}

async function fetchFilmarksMovieInfo(title: string): Promise<MovieSupplementalInfo> {
  try {
    const searchHtml = await fetchText(`${FILMARKS_ORIGIN}/search/movies?q=${encodeURIComponent(title)}`);
    const info = filmarksMovieInfoFromHtml(searchHtml, title);
    if (!info.reviewUrl) return info;
    try {
      const movieUrl = info.reviewUrl.replace(/\/reviews\/?$/, "/");
      const detailHtml = await fetchText(movieUrl);
      const structuredInfo = filmarksMovieInfoFromJsonLd(detailHtml, title);
      const formalInfo = structuredInfo.genres.length > 0 ? structuredInfo : info;
      const detailReview = filmarksMovieReviewFromHtml(detailHtml);
      return {
        ...info,
        ...formalInfo,
        reviewScore: detailReview.reviewScore ?? info.reviewScore,
        reviewCount: detailReview.reviewCount ?? info.reviewCount,
        reviewUrl: info.reviewUrl,
      };
    } catch (error) {
      console.warn(`Unable to load Filmarks review info for ${title}`, error);
      return info;
    }
  } catch (error) {
    console.warn(`Unable to load Filmarks movie info for ${title}`, error);
    return { genres: [], cast: [] };
  }
}

function getCachedFilmarksMovieInfo(title: string): Promise<MovieSupplementalInfo> {
  return unstable_cache(
    () => fetchFilmarksMovieInfo(title),
    ["signal-board-filmarks-movie-info-v6-formal-genres", title],
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
  formalGenres: string[] = [],
): Pick<FeedEntry, "movieType" | "genres"> {
  const detailText = plainText(html);
  const productionInfo = detailText.match(
    /製作[／/]\s*([\s\S]*?)(?=\s+配給[：:]|\s+劇場公開日|$)/i,
  )?.[1] ?? "";
  const productionFields = productionInfo
    .split(/[／/]/)
    .map((field) => field.trim())
    .filter(Boolean);
  const country = productionFields[productionFields.length - 1] ?? "";
  // Keep staff/credits out of the genre evidence. The page contains entries
  // such as "音楽" in the credits, which are not movie genres.
  const story = detailText.match(/解説・あらすじ([\s\S]*?)(?:スタッフ[・／/]?(?:声優[・／/])?キャスト|全てのスタッフ)/i)?.[1] ?? detailText.slice(0, 4_000);
  const animeEvidence = [
    title,
    description,
    country,
    story.split(/[。！？!?]/).slice(0, 2).join(" "),
    ...formalGenres,
  ].join(" ");
  const anime = formalGenres.some((genre) => /^アニメ(?:ーション)?$/i.test(genre)) ||
    /テレビアニメ|アニメーション|アニメ作品|アニメ映画|劇場版アニメ|anime|animation|3d\s*cg|cg作品/i.test(animeEvidence);
  const movieType: MovieType = anime
    ? "アニメ/CG"
    : country
      ? /日本|japan/i.test(country)
        ? "邦画"
        : "洋画"
      : /[A-Za-z]{3,}/.test(title)
        ? "洋画"
        : "邦画";
  // Use only the provider's formal genre field. Synopsis words such as
  // "パニック" describe plot events and must not become genres.
  const genres = [...new Set(formalGenres.map((genre) => FILMARKS_GENRE_MAP[genre] ?? genre))]
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

function gameTitleFor(value: string, fallback = "", sourceName?: string): string {
  const labeledTitle = [value, fallback]
    .map((text) => text.match(
      /ゲームタイトル\s*[:：]\s*([^。！？!?]{1,120}?)(?=\s*(?:ゲームジャンル|ジャンル|開発|SteamストアURL|価格|プラットフォーム|対応言語)\s*[:：]|[。！？!?]|$)/i,
    )?.[1].trim())
    .find((title): title is string => Boolean(title));
  if (labeledTitle) return labeledTitle.replace(/^[『「]|[』」]$/g, "").trim();

  const quotedCandidates = (text: string, pattern = /『([^』]+)』|「([^」]+)」/g) => [...text.matchAll(pattern)]
    .map((match) => ({
      title: match[1] ?? match[2] ?? "",
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    }))
    .filter((candidate) => candidate.title.trim().length > 0);
  const isAutomaton = sourceName === "AUTOMATON";
  const candidates = isAutomaton
    ? quotedCandidates(value, /『([^』]+)』/g)
    : quotedCandidates(value);
  const source = candidates.length > 0 ? value : fallback;
  const sourceCandidates = candidates.length > 0
    ? candidates
    : isAutomaton
      ? quotedCandidates(fallback, /『([^』]+)』/g)
      : quotedCandidates(fallback);
  const likelyCandidates = sourceCandidates.filter((candidate) =>
    !/(?:発売|配信|リリース|ローンチ|延期|中止|発表|時間前|時刻|タイトル|価格)/i.test(candidate.title),
  ).filter((candidate) => {
    if (!isAutomaton) return true;
    const suffix = source.slice(candidate.end, candidate.end + 28);
    return !/^\s*(?:リスペクト|風|ライク|インスパイア|から影響|に影響)/i.test(suffix);
  });
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
    ? likelyCandidates.filter((candidate) => candidate.index >= sentenceStart && candidate.index < releaseIndex)
    : [];
  const selected = isAutomaton
    ? sameSentenceBeforeRelease.at(-1) ?? likelyCandidates.at(-1) ?? sourceCandidates.at(-1)
    : sameSentenceBeforeRelease[0] ?? likelyCandidates[0] ?? sourceCandidates[0];
  return (selected?.title ?? value)
    .replace(/\s*[【\[].*?[】\]]\s*$/g, "")
    .trim();
}

function indiePlatformsFor(value: string): string[] {
  const platforms: string[] = [];
  if (/Steam|steamストア|PC\s*[（(]Steam/i.test(value)) platforms.push("Steam");
  if (/\bPS(?:5|4)?\b|PlayStation|プレイステーション/i.test(value)) platforms.push("PS");
  if (/Nintendo\s+Switch|Switch\s*2|ニンテンドー(?:スイッチ|Switch)/i.test(value)) platforms.push("Switch");
  if (/Xbox|XBOX|Xbox Live|XBLIG/i.test(value)) platforms.push("XBOX");
  return [...new Set(platforms)];
}

const INDIE_PRICE_TOKEN = String.raw`(?:無料|(?:[¥￥]\s*)?\d+(?:,\d{3})*\s*円|[¥￥]\s*\d+(?:,\d{3})*)(?:\s*(?:\([^)]*税込[^)]*\)|（[^）]*税込[^）]*）))?`;
const INDIE_PRICE_PLATFORM_PATTERNS: Array<[string, string]> = [
  ["PS", String.raw`(?:\bPS(?:5|4)?\b|PlayStation(?:\s?(?:5|4))?|プレイステーション(?:5|4)?)`],
  ["Switch", String.raw`(?:Nintendo\s+Switch|Switch\s*2|ニンテンドー(?:スイッチ|Switch))`],
  ["XBOX", String.raw`(?:Xbox(?:\s+(?:One|Series\s*[XxSs]))?|XBOX|エックスボックス)`],
  ["Steam", String.raw`(?:Steam|steamストア|PC\s*(?:版)?(?:\s*[（(]Steam[）)])?)`],
];

function normalizeIndiePrice(value: string): string {
  return value.replace(/\s+/g, "").replace(/￥/g, "¥");
}

function indiePricesFor(value: string): TopicPrice[] {
  const prices = new Map<string, string>();
  for (const [platform, platformPattern] of INDIE_PRICE_PLATFORM_PATTERNS) {
    const forward = new RegExp(
      `${platformPattern}[^。！？!?\\n]{0,100}?(${INDIE_PRICE_TOKEN})`,
      "gi",
    );
    const reverse = new RegExp(
      `(${INDIE_PRICE_TOKEN})[^。！？!?\\n]{0,50}?${platformPattern}`,
      "gi",
    );
    for (const match of value.matchAll(forward)) {
      if (!prices.has(platform)) prices.set(platform, normalizeIndiePrice(match[1]));
    }
    for (const match of value.matchAll(reverse)) {
      if (!prices.has(platform)) prices.set(platform, normalizeIndiePrice(match[1]));
    }
  }
  return INDIE_PRICE_PLATFORM_PATTERNS
    .map(([platform]) => ({ platform, value: prices.get(platform) }))
    .filter((price): price is TopicPrice => Boolean(price.value));
}

type IndieReleaseCandidate = {
  date: Date;
  platform: string;
  platforms: string[];
  evidence: number;
};

const INDIE_RELEASE_PLATFORM_PRIORITY = ["PS", "Switch", "XBOX", "Steam", "その他"] as const;

function indieReleasePlatformPriority(platform: string): number {
  const index = INDIE_RELEASE_PLATFORM_PRIORITY.indexOf(platform as typeof INDIE_RELEASE_PLATFORM_PRIORITY[number]);
  return index === -1 ? INDIE_RELEASE_PLATFORM_PRIORITY.length : index;
}

function indieReleasePlatformsFor(value: string, dateIndex: number): string[] {
  const sentenceStart = Math.max(
    value.lastIndexOf("。", dateIndex - 1),
    value.lastIndexOf("！", dateIndex - 1),
    value.lastIndexOf("？", dateIndex - 1),
    value.lastIndexOf("!", dateIndex - 1),
    value.lastIndexOf("?", dateIndex - 1),
    value.lastIndexOf("\n", dateIndex - 1),
  ) + 1;
  const sentenceEnds = ["。", "！", "？", "!", "?", "\n"]
    .map((delimiter) => value.indexOf(delimiter, dateIndex))
    .filter((index) => index >= 0);
  const sentenceEnd = sentenceEnds.length > 0 ? Math.min(...sentenceEnds) : value.length;
  const sentence = value.slice(sentenceStart, sentenceEnd + 1);
  const sentenceDateCount = [...sentence.matchAll(
    /(?:20\d{2}年\s*)?\d{1,2}月\s*\d{1,2}日?|20\d{2}[./-]\d{1,2}[./-]\d{1,2}/g,
  )].length;
  if (sentence.length <= 260 && sentenceDateCount <= 1) {
    const sentencePlatforms = indiePlatformsFor(sentence);
    if (sentencePlatforms.length > 0) {
      return [...sentencePlatforms].sort(
        (a, b) => indieReleasePlatformPriority(a) - indieReleasePlatformPriority(b),
      );
    }
  }

  const mentions = [
    { platform: "PS", pattern: /\bPS(?:5|4)?\b|PlayStation|プレイステーション/gi },
    { platform: "Switch", pattern: /Nintendo\s+Switch|Switch\s*2|ニンテンドー(?:スイッチ|Switch)/gi },
    { platform: "XBOX", pattern: /Xbox|XBOX|Xbox Live|XBLIG/gi },
    { platform: "Steam", pattern: /Steam|steamストア|PC\s*[（(]Steam/gi },
  ].flatMap(({ platform, pattern }) => [...value.matchAll(pattern)].map((match) => ({
    platform,
    distance: Math.abs((match.index ?? 0) - dateIndex),
  })));
  const nearest = mentions
    .filter((mention) => mention.distance <= 90)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return indieReleasePlatformPriority(a.platform) - indieReleasePlatformPriority(b.platform);
    })[0]?.platform;
  return [nearest ?? "その他"];
}

function indieReleaseCandidates(value: string, articleDate?: Date): IndieReleaseCandidate[] {
  const candidates: IndieReleaseCandidate[] = [];
  const addCandidate = (match: RegExpMatchArray, year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return;
    const matchIndex = match.index ?? 0;
    const contextStart = Math.max(0, (match.index ?? 0) - 90);
    const contextEnd = Math.min(value.length, (match.index ?? 0) + match[0].length + 90);
    const context = value.slice(contextStart, contextEnd);
    if (!/(発売|配信|リリース|販売|ローンチ|launch|release)/i.test(context)) return;
    if (/(?:発売|配信|リリース|販売)[^。！？!?]{0,20}(?:延期|中止|取りやめ)|(?:延期|中止|取りやめ)[^。！？!?]{0,20}(?:発売|配信|リリース|販売)/i.test(context)) return;
    const before = value.slice(Math.max(0, matchIndex - 40), matchIndex);
    const after = value.slice(matchIndex + match[0].length, matchIndex + match[0].length + 40);
    const directlyFollowedByRelease = /^\s*(?:に|より|から)?\s*(?:正式)?(?:発売|配信|リリース|販売|ローンチ|launch|release)(?:予定|開始)?/i.test(after);
    const directlyPrecededByRelease = /(?:発売日|配信日|リリース日|発売予定日|配信予定日|リリース予定日)(?:は|が|を|：|:)?\s*$/i.test(before);
    const releasePlatforms = indieReleasePlatformsFor(value, matchIndex);
    candidates.push({
      date,
      platform: releasePlatforms[0] ?? "その他",
      platforms: releasePlatforms,
      evidence: directlyFollowedByRelease || directlyPrecededByRelease ? 2 : 1,
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
      const before = value.slice(Math.max(0, (match.index ?? 0) - 12), match.index ?? 0);
      if (/20\d{2}年\s*$/.test(before)) continue;
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
      if (a.evidence !== b.evidence) return b.evidence - a.evidence;
      const priority = indieReleasePlatformPriority(a.platform) - indieReleasePlatformPriority(b.platform);
      if (priority !== 0) return priority;
      return a.date.getTime() - b.date.getTime();
    })[0];
}

function indieReleaseDateValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function indieReleaseDatesFor(value: string, articleDate?: Date): TopicReleaseDate[] {
  const selected = new Map<string, IndieReleaseCandidate>();
  for (const candidate of indieReleaseCandidates(value, articleDate)) {
    for (const platform of candidate.platforms) {
      const current = selected.get(platform);
      if (!current || candidate.evidence > current.evidence ||
        (candidate.evidence === current.evidence && candidate.date < current.date)) {
        selected.set(platform, candidate);
      }
    }
  }
  return orderedIndiePlatforms(selected.keys()).flatMap((platform) => {
    const candidate = selected.get(platform);
    return candidate ? [{ platform, value: indieReleaseDateValue(candidate.date) }] : [];
  });
}

function hasJapaneseSupport(value: string): boolean {
  return /(?:対応言語|言語|字幕|音声|テキスト|表示)[^。\n]{0,80}日本語|日本語[^。\n]{0,80}(?:対応|版|化|字幕|音声|表示|収録|テキスト)|Japanese/i.test(value);
}

function hasJapanReleaseEvidence(value: string): boolean {
  return /日本(?:国内)?[^。\n]{0,80}(?:発売|リリース|配信)(?:予定|開始|中|済み|された|されている|した)?|国内[^。\n]{0,80}(?:発売|リリース|配信)(?:予定|開始|中|済み|された|されている|した)?|(?:Steam|Switch|PS5|PS4|Xbox)[^。\n]{0,80}(?:発売|リリース|配信)(?:予定|開始|中|済み|された|されている|した)?|(?:正式)?(?:発売|リリース|配信)(?:予定|されて|済み|開始|中)|正式リリース|released/i.test(value);
}

const INDIE_PLATFORM_DISPLAY_ORDER = ["Steam", "PS", "Switch", "XBOX", "その他"] as const;

function normalizeIndieTrackingTitle(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[「」『』【】™®©]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[（(][ァ-ヶー・\s]+[）)]$/g, "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("en-US")
    .trim();
}

function orderedIndiePlatforms(values: Iterable<string>): string[] {
  const unique = new Set(values);
  const known = INDIE_PLATFORM_DISPLAY_ORDER.filter((platform) => unique.delete(platform));
  return [...known, ...unique];
}

function mergeIndiePrices(current: TopicPrice[] = [], supplemental: TopicPrice[] = []): TopicPrice[] {
  const prices = new Map<string, string>();
  for (const price of current) prices.set(price.platform, price.value);
  for (const price of supplemental) prices.set(price.platform, price.value);
  return orderedIndiePlatforms(prices.keys()).flatMap((platform) => {
    const value = prices.get(platform);
    return value ? [{ platform, value }] : [];
  });
}

function releaseDatesWithPrimary(
  releaseDates: TopicReleaseDate[] = [],
  releaseDate?: string,
  releasePlatform?: string,
): TopicReleaseDate[] {
  if (!releaseDate) return releaseDates;
  if (releaseDates.some((item) => item.platform === (releasePlatform ?? "その他"))) {
    return releaseDates;
  }
  return [...releaseDates, { platform: releasePlatform ?? "その他", value: releaseDate }];
}

function mergeIndieReleaseDates(
  current: TopicReleaseDate[] = [],
  supplemental: TopicReleaseDate[] = [],
): TopicReleaseDate[] {
  const dates = new Map<string, string>();
  for (const item of current) dates.set(item.platform, item.value);
  for (const item of supplemental) dates.set(item.platform, item.value);
  return orderedIndiePlatforms(dates.keys()).flatMap((platform) => {
    const value = dates.get(platform);
    return value ? [{ platform, value }] : [];
  });
}

function indieReleaseDatesLabel(releaseDates: TopicReleaseDate[]): string {
  return releaseDates.length > 0
    ? releaseDates.map((item) => `${item.platform}: ${dateLabel(item.value, "").trim()}`).join("\n")
    : "不明";
}

function trackingUpdateForEntry(entry: FeedEntry): IndieGameTrackingUpdate | undefined {
  if (!entry.link || entry.platforms?.length === 0) return undefined;
  const titleKey = normalizeIndieTrackingTitle(entry.title);
  if (!titleKey) return undefined;
  const observedAt = parseDate(entry.date)?.toISOString() ?? new Date().toISOString();
  return {
    titleKey,
    title: entry.title,
    platforms: entry.platforms ?? [],
    prices: entry.prices,
    releaseDate: entry.releaseDate,
    releaseDates: releaseDatesWithPrimary(entry.releaseDates, entry.releaseDate, entry.releasePlatform),
    releasePlatform: entry.releasePlatform,
    evidence: {
      source: entry.source ?? "外部サイト",
      url: entry.link,
      observedAt,
    },
  };
}

function indieSupplementFromText({
  expectedTitle,
  heading,
  description,
  content,
  date,
  image,
  source,
  link,
}: {
  expectedTitle: string;
  heading: string;
  description?: string;
  content: string;
  date?: string;
  image?: string;
  source: string;
  link: string;
}): FeedEntry | undefined {
  const displayTitle = gameTitleFor(heading, content, source);
  if (normalizeIndieTrackingTitle(displayTitle) !== normalizeIndieTrackingTitle(expectedTitle)) {
    return undefined;
  }
  const searchable = `${displayTitle} ${description ?? ""} ${content}`;
  const platforms = indiePlatformsFor(searchable);
  const release = indieReleaseFor(searchable, parseDate(date));
  const releaseDates = indieReleaseDatesFor(searchable, parseDate(date))
    .filter((item) => platforms.includes(item.platform));
  if (platforms.length === 0 || (!release && !hasJapanReleaseEvidence(searchable))) {
    return undefined;
  }
  return {
    title: displayTitle,
    link,
    description: description || plainText(content).slice(0, 260),
    date,
    image,
    source,
    platforms,
    prices: indiePricesFor(searchable).filter((price) => platforms.includes(price.platform)),
    releaseDate: release ? indieReleaseDateValue(release.date) : undefined,
    releaseDates,
    releasePlatform: release?.platform,
  };
}

interface FamitsuSearchArticle {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  content?: unknown;
  publishedAt?: unknown;
  thumbnailUrl?: unknown;
}

async function searchFamitsuIndieTitle(title: string): Promise<FeedEntry[]> {
  const params = new URLSearchParams({
    type: "article",
    q: title,
    max: "100",
    order: "desc",
    page: "1",
    executedPagePath: "/search",
  });
  const response = await fetch(`https://www.famitsu.com/api/search?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "SignalBoard/1.0 (+public data reader)" },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok && response.status !== 400) {
    throw new Error(`Famitsu search returned ${response.status}`);
  }
  const payload = (await response.json()) as { data?: FamitsuSearchArticle[] };
  return (payload.data ?? []).flatMap((article) => {
    if (typeof article.id !== "string" ||
      typeof article.title !== "string" ||
      typeof article.content !== "string") return [];
    const date = typeof article.publishedAt === "string" ? article.publishedAt : undefined;
    const published = parseDate(date);
    if (!published) return [];
    const yearMonth = `${published.getFullYear()}${String(published.getMonth() + 1).padStart(2, "0")}`;
    const entry = indieSupplementFromText({
      expectedTitle: title,
      heading: article.title,
      description: typeof article.description === "string" ? article.description : undefined,
      content: plainText(article.content),
      date,
      image: typeof article.thumbnailUrl === "string" ? article.thumbnailUrl : undefined,
      source: "ファミ通.comインディーゲーム",
      link: `https://www.famitsu.com/article/${yearMonth}/${article.id}`,
    });
    return entry ? [entry] : [];
  });
}

async function fetchIndieSupplementArticle(
  entry: FeedEntry,
  expectedTitle: string,
): Promise<FeedEntry | undefined> {
  if (!entry.link) return undefined;
  try {
    const html = await fetchText(entry.link);
    const contentHtml = articleContentHtml(html);
    const contentText = plainText(contentHtml);
    const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
      .map((match) => plainText(match[1]));
    const heading = headings.at(-1) ?? entry.title;
    return indieSupplementFromText({
      expectedTitle,
      heading,
      description: plainText(
        metaContent(html, "description") ??
        metaContent(html, "og:description") ??
        entry.description ?? "",
      ),
      content: contentText,
      date: articleUpdatedDateFor(html, contentText) ?? entry.date,
      image: metaContent(html, "og:image") ?? entry.image,
      source: entry.source ?? "外部サイト",
      link: entry.link,
    });
  } catch {
    return undefined;
  }
}

async function searchWordPressIndieTitle(
  title: string,
  source: "AUTOMATON" | "Indie Games Japan",
  origin: string,
): Promise<FeedEntry[]> {
  try {
    const xml = await fetchText(
      `${origin}/search/${encodeURIComponent(title)}/feed/rss2/`,
      "application/rss+xml,application/xml",
    );
    const candidates = parseFeed(xml)
      .map((entry) => ({ ...entry, source }))
      .filter((entry) => {
        const extracted = gameTitleFor(entry.title, entry.description, source);
        return normalizeIndieTrackingTitle(extracted) === normalizeIndieTrackingTitle(title) ||
          normalizeIndieTrackingTitle(entry.title).includes(normalizeIndieTrackingTitle(title));
      })
      .slice(0, 5);
    return (await mapWithConcurrency(
      candidates,
      2,
      (entry) => fetchIndieSupplementArticle(entry, title),
    )).filter((entry): entry is FeedEntry => Boolean(entry));
  } catch {
    return [];
  }
}

async function searchIndieFollowups(title: string): Promise<{
  entries: FeedEntry[];
  succeeded: boolean;
}> {
  const results = await Promise.allSettled([
    searchFamitsuIndieTitle(title),
    searchWordPressIndieTitle(title, "AUTOMATON", "https://automaton-media.com"),
    searchWordPressIndieTitle(title, "Indie Games Japan", "https://indiegamesjapan.com"),
  ]);
  return {
    entries: results.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    succeeded: results.some((result) => result.status === "fulfilled"),
  };
}

function entryWithIndieTracking(
  entry: FeedEntry,
  tracking: IndieGameTrackingRecord | undefined,
): FeedEntry {
  if (!tracking) return entry;
  const currentPriority = indieReleasePlatformPriority(entry.releasePlatform ?? "その他");
  const trackedPriority = indieReleasePlatformPriority(tracking.releasePlatform ?? "その他");
  const useTrackedRelease = Boolean(tracking.releaseDate) &&
    (!entry.releaseDate || trackedPriority <= currentPriority);
  const platforms = orderedIndiePlatforms([...(entry.platforms ?? []), ...tracking.platforms]);
  const releaseDates = mergeIndieReleaseDates(
    releaseDatesWithPrimary(entry.releaseDates, entry.releaseDate, entry.releasePlatform),
    tracking.releaseDates,
  ).filter((item) => platforms.includes(item.platform));
  return {
    ...entry,
    platforms,
    prices: mergeIndiePrices(entry.prices, tracking.prices),
    releaseDate: useTrackedRelease ? tracking.releaseDate : entry.releaseDate,
    releaseDates,
    releasePlatform: useTrackedRelease ? tracking.releasePlatform : entry.releasePlatform,
    trackingSources: [...new Set(
      tracking.evidence
        .filter((evidence) => evidence.url !== entry.link)
        .map((evidence) => evidence.source),
    )],
  };
}

async function refreshIndieGameTracking(entries: FeedEntry[]): Promise<FeedEntry[]> {
  try {
    const baseUpdates = entries.flatMap((entry) => {
      const update = trackingUpdateForEntry(entry);
      return update ? [update] : [];
    });
    mergeIndieGameTracking(baseUpdates);

    const currentTracking = new Map(
      listIndieGameTracking().map((record) => [record.titleKey, record]),
    );
    const uniqueEntries = [...new Map(
      entries.map((entry) => [normalizeIndieTrackingTitle(entry.title), entry]),
    ).values()];
    const recheckCutoff = Date.now() - INDIE_TRACKING_RECHECK_DAYS * 24 * 60 * 60 * 1_000;
    const followupCandidates = uniqueEntries
      .filter((entry) => {
        const titleKey = normalizeIndieTrackingTitle(entry.title);
        const tracking = currentTracking.get(titleKey);
        const platforms = new Set([...(entry.platforms ?? []), ...(tracking?.platforms ?? [])]);
        const hasConsole = ["PS", "Switch", "XBOX"].some((platform) => platforms.has(platform));
        const datedPlatforms = new Set([
          ...(entry.releaseDates ?? []).map((item) => item.platform),
          ...(tracking?.releaseDates ?? []).map((item) => item.platform),
        ]);
        const hasMissingPlatformDates = [...platforms]
          .some((platform) => platform !== "その他" && !datedPlatforms.has(platform));
        const checkedAt = tracking?.lastCheckedAt ? Date.parse(tracking.lastCheckedAt) : 0;
        return (!hasConsole || hasMissingPlatformDates) &&
          (!Number.isFinite(checkedAt) || checkedAt < recheckCutoff);
      })
      .sort((a, b) => a.title.localeCompare(b.title, "en"))
      .slice(0, INDIE_TRACKING_SEARCH_LIMIT);

    const followups = await mapWithConcurrency(followupCandidates, 3, async (entry) => ({
      titleKey: normalizeIndieTrackingTitle(entry.title),
      result: await searchIndieFollowups(entry.title),
    }));
    const supplementalUpdates = followups.flatMap(({ result }) =>
      result.entries.flatMap((entry) => {
        const update = trackingUpdateForEntry(entry);
        return update ? [update] : [];
      }));
    mergeIndieGameTracking(supplementalUpdates);
    markIndieGameTrackingChecked(
      followups.filter(({ result }) => result.succeeded).map(({ titleKey }) => titleKey),
    );

    const refreshed = new Map(
      listIndieGameTracking().map((record) => [record.titleKey, record]),
    );
    return entries.map((entry) =>
      entryWithIndieTracking(entry, refreshed.get(normalizeIndieTrackingTitle(entry.title))));
  } catch (error) {
    console.warn("Unable to refresh indie-game platform tracking", error);
    return entries;
  }
}

function boardWithIndieTracking(
  item: TopicBoard,
  tracking: IndieGameTrackingRecord | undefined,
): TopicBoard {
  if (!tracking || item.domain !== "indie-game") return item;
  const platforms = orderedIndiePlatforms([...(item.platforms ?? []), ...tracking.platforms]);
  const mergedPrices = mergeIndiePrices(item.prices, tracking.prices);
  const mergedReleaseDates = mergeIndieReleaseDates(
    releaseDatesWithPrimary(item.releaseDates, item.releaseDate, item.releasePlatform),
    tracking.releaseDates,
  ).filter((entry) => platforms.includes(entry.platform));
  const currentPriority = indieReleasePlatformPriority(item.releasePlatform ?? "その他");
  const trackedPriority = indieReleasePlatformPriority(tracking.releasePlatform ?? "その他");
  const useTrackedRelease = Boolean(tracking.releaseDate) &&
    (!item.releaseDate || trackedPriority <= currentPriority);
  const releaseDate = useTrackedRelease ? tracking.releaseDate : item.releaseDate;
  const releasePlatform = useTrackedRelease ? tracking.releasePlatform : item.releasePlatform;
  const supplementalSources = [...new Set(
    tracking.evidence
      .filter((evidence) => evidence.url !== item.sourceUrl)
      .map((evidence) => evidence.source),
  )];
  const metricValues = new Map(item.metrics.map((metric) => [metric.label, metric.value]));
  metricValues.set("プラットフォーム", platforms.join(" / "));
  metricValues.set(
    "価格",
    mergedPrices.length > 0
      ? mergedPrices.map((price) => `${price.platform}: ${price.value}`).join("\n")
      : "記事記載なし",
  );
  metricValues.set("発売日", indieReleaseDatesLabel(mergedReleaseDates));
  if (supplementalSources.length > 0) {
    metricValues.set("情報補完", `${supplementalSources.join(" / ")}の後続記事`);
  }
  const metricOrder = [...item.metrics.map((metric) => metric.label)];
  if (supplementalSources.length > 0 && !metricOrder.includes("情報補完")) {
    metricOrder.push("情報補完");
  }
  const nonPlatformTags = item.tags.filter(
    (tag) => !INDIE_PLATFORM_DISPLAY_ORDER.includes(tag as typeof INDIE_PLATFORM_DISPLAY_ORDER[number]),
  );
  return {
    ...item,
    dateLabel: dateLabel(
      releaseDate,
      `${releasePlatform && releasePlatform !== "その他" ? `${releasePlatform}発売日` : "発売日"}`,
    ),
    releaseDate,
    releaseDates: mergedReleaseDates,
    releasePlatform,
    platforms,
    prices: mergedPrices,
    metrics: metricOrder.flatMap((label) => {
      const value = metricValues.get(label);
      return value === undefined ? [] : [{ label, value }];
    }),
    tags: [...nonPlatformTags, ...platforms],
  };
}

function feedWithIndieTracking(feed: TopicFeed): TopicFeed {
  try {
    const tracking = new Map(
      listIndieGameTracking().map((record) => [record.titleKey, record]),
    );
    const items = feed.items.map((item) =>
      boardWithIndieTracking(item, tracking.get(normalizeIndieTrackingTitle(item.title))));
    const supplemented = items.some((item) => item.metrics.some((metric) => metric.label === "情報補完"));
    return {
      ...feed,
      items,
      sourceName: supplemented && !feed.sourceName.includes("後続記事追跡")
        ? `${feed.sourceName} / 後続記事追跡: 3サイト`
        : feed.sourceName,
    };
  } catch (error) {
    console.warn("Unable to apply indie-game tracking metadata", error);
    return feed;
  }
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
    const displayTitle = gameTitleFor(title, contentText, entry.source);
    const searchable = `${displayTitle} ${description} ${contentText}`;
    const platforms = indiePlatformsFor(searchable);
    const prices = indiePricesFor(searchable).filter((price) => platforms.includes(price.platform));
    const articleDate = parseDate(date);
    const release = indieReleaseFor(searchable, articleDate);
    const releaseDates = indieReleaseDatesFor(searchable, articleDate)
      .filter((item) => platforms.includes(item.platform));
    const eligible = Boolean(release) && hasJapanReleaseEvidence(searchable) && hasJapaneseSupport(searchable) && platforms.length > 0;
    if (!eligible) return undefined;
    return {
      ...entry,
      title: displayTitle,
      description,
      date,
      image: image ? absoluteUrl(image, entry.link) : undefined,
      platforms,
      prices,
      genres: indieGameGenresFromText(searchable, displayTitle),
      releaseDate: release ? indieReleaseDateValue(release.date) : undefined,
      releaseDates,
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
  const results = await Promise.allSettled([
    fetchText(TOKYO_REDEVELOPMENT_INDEX),
    fetchText(SAPPORO_REDEVELOPMENT_INDEX),
  ]);
  const entries = results.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    return index === 0
      ? parseTokyoRedevelopmentList(result.value)
      : parseSapporoRedevelopmentList(result.value);
  });
  const uniqueEntries = [...new Map(
    entries.map((entry) => [`${entry.region}-${entry.location}-${entry.title}`, entry]),
  ).values()];
  if (uniqueEntries.length === 0) throw new Error("No redevelopment project entries");

  return {
    items: [...uniqueEntries.map(redevelopmentCard), ...redevelopmentSpotlights],
    mode: "live",
    sourceName: "東京都・札幌市 公式再開発地区一覧 / 全国注目プロジェクト選定",
  };
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
    ...Array.from({ length: 16 }, (_, index) => ({
      source: sources[1].name,
      load: async () => {
        const html = await fetchText(`https://automaton-media.com/articles/newsjp/page/${index + 1}/`);
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
  const trackedEntries = await refreshIndieGameTracking(verifiedEntries);
  const uniqueGames = [...new Map(
    trackedEntries.map((entry) => [normalizeIndieTrackingTitle(entry.title), entry]),
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
      releaseDates: entry.releaseDates,
      releasePlatform: entry.releasePlatform,
      articleUpdatedLabel: dateLabel(entry.date, "記事更新"),
      location: entry.source ?? "外部メディア",
      region: entry.source ?? "外部メディア",
      summary: entry.description || `${entry.source ?? "外部ゲームメディア"}から取得した記事です。`,
      image: imageFor("indie-game", index, entry.image),
      platforms,
      prices: entry.prices,
      genres: entry.genres,
      metrics: [
        { label: "情報源", value: entry.source ?? "外部サイト" },
        { label: "カテゴリ", value: category },
        { label: "プラットフォーム", value: platforms.join(" / ") },
        {
          label: "価格",
          value: entry.prices?.length
            ? entry.prices.map((price) => `${price.platform}: ${price.value}`).join("\n")
            : "記事記載なし",
        },
        {
          label: "発売日",
          value: indieReleaseDatesLabel(
            releaseDatesWithPrimary(entry.releaseDates, entry.releaseDate, entry.releasePlatform),
          ),
        },
        { label: "記事更新", value: dateLabel(entry.date, "").trim() || "不明" },
        { label: "対応言語", value: "日本語あり" },
        ...(entry.trackingSources?.length
          ? [{ label: "情報補完", value: `${entry.trackingSources.join(" / ")}の後続記事` }]
          : []),
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
    sourceName: `取得対象: ${activeSources || "指定インディーゲームサイト"} / 条件適合カード: ${eligibleSources || "なし"} / 後続記事追跡: 3サイト`,
    updatedAt: updatedAt(uniqueGames),
    cacheVersion: INDIE_GAME_FEED_CACHE_VERSION,
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

function eigaMovieReviewUrl(url: string): string {
  return `${url.replace(/\/+$/, "")}/review/`;
}

function movieReviewMetricValue(score?: string, count?: string): string {
  const rating = score ? `${score} / 5` : "未評価";
  return count ? `${rating} (${count}件)` : rating;
}

function parseMovieDistributor(html: string): string | undefined {
  const detailText = plainText(html);
  return detailText.match(
    /配給[：:]\s*([\s\S]*?)(?=\s+(?:劇場公開日|公開日|上映時間|ジャンル|スタッフ|解説|レビュー)[：:]|$)/i,
  )?.[1]?.trim();
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
    const eigaCredits = parseMovieCredits(html);
    const filmarksInfo = await getCachedFilmarksMovieInfo(cleanTitle);
    const classification = classifyMovie(cleanTitle, description, html, filmarksInfo.genres);
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
      reviewUrl: eigaMovieReviewUrl(url),
      filmarksReviewScore: filmarksInfo.reviewScore,
      filmarksReviewCount: filmarksInfo.reviewCount,
      filmarksReviewUrl: filmarksInfo.reviewUrl,
      distributor: parseMovieDistributor(html),
      director: eigaCredits.director ?? filmarksInfo.director,
      cast: eigaCredits.cast?.length ? eigaCredits.cast : filmarksInfo.cast,
      genreSources: filmarksInfo.genres.length > 0 ? ["Filmarks"] : [],
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
    ["signal-board-movie-detail-v17-formal-genres", status, url],
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
        value: entry.genreSources?.includes("Filmarks") ? "Filmarks（正式ジャンル）" : "ジャンル未取得",
      },
      {
        label: "レビュー",
        value: movieReviewMetricValue(entry.reviewScore, entry.reviewCount),
        lines: [
          {
            label: "映画.com",
            value: movieReviewMetricValue(entry.reviewScore, entry.reviewCount),
            href: entry.reviewUrl,
          },
          {
            label: "Filmarks",
            value: movieReviewMetricValue(entry.filmarksReviewScore, entry.filmarksReviewCount),
            href: entry.filmarksReviewUrl,
          },
        ],
      },
      { label: "配給元", value: entry.distributor || "掲載なし" },
      { label: "監督", value: entry.director || "掲載なし" },
      { label: "メインキャスト", value: entry.cast?.length ? entry.cast.join("\n") : "掲載なし" },
    ],
    updates: [{ at: dateLabel(entry.date, "").trim() || "最新", text: "映画.comの作品情報を更新" }],
    tags: [
      "映画.com",
      ...(entry.genreSources?.includes("Filmarks") ? ["Filmarks（正式ジャンル）"] : []),
      entry.status === "screening" ? "上映中" : "公開予定",
      ...(entry.genres ?? []),
    ],
    movieType: entry.movieType,
    genres: entry.genres,
  }));
  return {
    items,
    mode: "live",
    sourceName: "映画.com 上映中・公開予定",
    updatedAt: new Date().toISOString(),
    cacheVersion: MOVIE_FEED_CACHE_VERSION,
  };
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

function migrateMovieReviewMetrics(feed: TopicFeed): TopicFeed {
  const items = feed.items.map((item) => {
    if (item.domain !== "movie") return item;
    const eigaReview = item.metrics.find((metric) => metric.label === "映画.comレビュー");
    const filmarksReview = item.metrics.find((metric) => metric.label === "Filmarksレビュー");
    const normalizeLine = (line: TopicMetricLine): TopicMetricLine =>
      line.label === "Filmarks"
        ? { ...line, href: normalizeFilmarksMovieUrl(line.href) }
        : line;
    if (!eigaReview && !filmarksReview) {
      const metrics = item.metrics.map((metric) =>
        metric.label === "レビュー" && metric.lines
          ? { ...metric, lines: metric.lines.map(normalizeLine) }
          : metric,
      );
      return { ...item, metrics };
    }

    const reviewLines: TopicMetricLine[] = [];
    if (eigaReview) reviewLines.push({ label: "映画.com", value: eigaReview.value, href: eigaReview.href });
    if (filmarksReview) {
      reviewLines.push({
        label: "Filmarks",
        value: filmarksReview.value,
        href: normalizeFilmarksMovieUrl(filmarksReview.href),
      });
    }
    const reviewMetric = {
      label: "レビュー",
      value: eigaReview?.value ?? filmarksReview?.value ?? "未評価",
      lines: reviewLines,
    };
    const metrics = [] as typeof item.metrics;
    let inserted = false;
    for (const metric of item.metrics) {
      if (metric.label === "映画.comレビュー") {
        if (!inserted) {
          metrics.push(reviewMetric);
          metrics.push({ label: "配給元", value: "掲載なし" });
          inserted = true;
        }
        continue;
      }
      if (metric.label === "Filmarksレビュー") continue;
      metrics.push(metric);
    }
    return { ...item, metrics };
  });
  return { ...feed, items };
}

const getCachedTopicFeed = unstable_cache(
  async (domain: TopicDomain) => buildTopicFeed(domain),
  ["signal-board-topic-feed-v60-filmarks-review-score"],
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
    // Redevelopment must not fall back to the old press-release snapshot,
    // but a snapshot generated from the official project lists is valid.
    if (domain === "redevelopment" && feed.sourceName !== "東京都・札幌市 公式再開発地区一覧 / 全国注目プロジェクト選定") {
      return undefined;
    }
    if (domain === "movie") return migrateMovieReviewMetrics(feed);
    if (domain === "indie-game" &&
      (feed.cacheVersion !== INDIE_GAME_FEED_CACHE_VERSION ||
        feed.items.some((item) => !item.releaseDate || !Array.isArray(item.genres)))) return undefined;
    return domain === "indie-game" ? feedWithIndieTracking(feed) : feed;
  } catch {
    return undefined;
  }
}

async function writeLastGoodFeed(domain: TopicDomain, feed: TopicFeed): Promise<void> {
  if (feed.mode !== "live" || feed.items.length === 0) return;
  try {
    await fs.mkdir(LAST_GOOD_FEED_DIR, { recursive: true });
    const target = path.join(LAST_GOOD_FEED_DIR, `${domain}.json`);
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(feed), "utf8");
    await fs.rename(temporary, target);
  } catch {
    // The deployment filesystem may be read-only; the Next data cache still remains available.
  }
}

async function touchLastGoodFeed(domain: TopicDomain): Promise<void> {
  try {
    const target = path.join(LAST_GOOD_FEED_DIR, `${domain}.json`);
    const now = new Date();
    await fs.utimes(target, now, now);
  } catch {
    // Ignore unavailable or read-only cache storage.
  }
}

async function withSoftTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getTopicFeed(domain: TopicDomain): Promise<TopicFeed> {
  const persistedFeed = await readLastGoodFeed(domain);
  if (persistedFeed) {
    const needsMovieRefresh = domain === "movie" && persistedFeed.cacheVersion !== MOVIE_FEED_CACHE_VERSION;
    try {
      const stat = await fs.stat(path.join(LAST_GOOD_FEED_DIR, `${domain}.json`));
      if (!needsMovieRefresh && Date.now() - stat.mtimeMs < LAST_GOOD_FEED_MAX_AGE_MS) return persistedFeed;
    } catch {
      // Fall through to a live refresh when the snapshot timestamp is unavailable.
    }
  }
  const liveFeedPromise = getCachedTopicFeed(domain);
  try {
    const feed = await withSoftTimeout(liveFeedPromise, FEED_SOFT_TIMEOUT_MS);
    if (!feed) {
      if (persistedFeed) {
        void liveFeedPromise
          .then((freshFeed) => writeLastGoodFeed(domain, freshFeed))
          .catch(() => undefined);
        await touchLastGoodFeed(domain);
        console.warn(`Live ${domain} feed is slow; using last good feed snapshot`);
        return persistedFeed;
      }
      const uncappedFeed = await liveFeedPromise;
      await writeLastGoodFeed(domain, uncappedFeed);
      return uncappedFeed;
    }
    await writeLastGoodFeed(domain, feed);
    return feed;
  } catch (error) {
    console.warn(`Unable to load live ${domain} feed`, error);
    if (persistedFeed) {
      await touchLastGoodFeed(domain);
      console.warn(`Using last good ${domain} feed snapshot`);
      return persistedFeed;
    }
    if (domain !== "redevelopment") {
      for (const cacheKey of LEGACY_TOPIC_FEED_CACHE_KEYS) {
        try {
          const staleFeed = await getLegacyCachedTopicFeed(cacheKey)(domain);
          if (staleFeed.mode === "live" && staleFeed.items.length > 0 &&
            (domain !== "indie-game" || staleFeed.items.every((item) => Boolean(item.releaseDate) && Array.isArray(item.genres))) &&
            (domain !== "movie" || staleFeed.cacheVersion === MOVIE_FEED_CACHE_VERSION)) {
            console.warn(`Using stale ${domain} feed cache ${cacheKey}`);
            return domain === "indie-game" ? feedWithIndieTracking(staleFeed) : staleFeed;
          }
        } catch {
          // Try the next legacy cache before falling back to saved data.
        }
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
