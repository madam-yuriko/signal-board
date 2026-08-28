import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { TopicPrice, TopicReleaseDate } from "@/types/topics";

export interface IndieGameTrackingEvidence {
  source: string;
  url: string;
  observedAt: string;
}

export interface IndieGameTrackingRecord {
  titleKey: string;
  title: string;
  platforms: string[];
  prices: TopicPrice[];
  releaseDates: Array<TopicReleaseDate & { evidenceAt?: string }>;
  releaseDate?: string;
  releasePlatform?: string;
  releaseEvidenceAt?: string;
  evidence: IndieGameTrackingEvidence[];
  lastCheckedAt?: string;
  updatedAt: string;
}

export interface IndieGameTrackingUpdate {
  titleKey: string;
  title: string;
  platforms: string[];
  prices?: TopicPrice[];
  releaseDates?: TopicReleaseDate[];
  releaseDate?: string;
  releasePlatform?: string;
  evidence: IndieGameTrackingEvidence;
}

const DATABASE_DIRECTORY = path.join(process.cwd(), ".signal-board-data");
const DATABASE_PATH = path.join(DATABASE_DIRECTORY, "signal-board.sqlite");
const PLATFORM_ORDER = ["Steam", "PS", "Switch", "XBOX", "その他"] as const;
const RELEASE_PRIORITY = ["PS", "Switch", "XBOX", "Steam", "その他"] as const;

function openDatabase(): DatabaseSync {
  mkdirSync(DATABASE_DIRECTORY, { recursive: true });
  const database = new DatabaseSync(DATABASE_PATH);
  database.exec(`
    CREATE TABLE IF NOT EXISTS indie_game_tracking (
      title_key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      platforms_json TEXT NOT NULL,
      prices_json TEXT NOT NULL,
      release_dates_json TEXT NOT NULL DEFAULT '[]',
      release_date TEXT,
      release_platform TEXT,
      release_evidence_at TEXT,
      evidence_json TEXT NOT NULL,
      last_checked_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  const columns = database.prepare("PRAGMA table_info(indie_game_tracking)").all();
  if (!columns.some((column) => column.name === "release_dates_json")) {
    database.exec("ALTER TABLE indie_game_tracking ADD COLUMN release_dates_json TEXT NOT NULL DEFAULT '[]'");
    database.exec("UPDATE indie_game_tracking SET last_checked_at = NULL");
  }
  return database;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function prices(value: unknown): TopicPrice[] {
  return Array.isArray(value)
    ? value.filter((item): item is TopicPrice => Boolean(
        item && typeof item === "object" &&
        typeof (item as TopicPrice).platform === "string" &&
        typeof (item as TopicPrice).value === "string",
      ))
    : [];
}

function releaseDates(value: unknown): Array<TopicReleaseDate & { evidenceAt?: string }> {
  return Array.isArray(value)
    ? value.filter((item): item is TopicReleaseDate & { evidenceAt?: string } => Boolean(
        item && typeof item === "object" &&
        typeof (item as TopicReleaseDate).platform === "string" &&
        typeof (item as TopicReleaseDate).value === "string" &&
        (typeof (item as { evidenceAt?: unknown }).evidenceAt === "string" ||
          (item as { evidenceAt?: unknown }).evidenceAt === undefined),
      ))
    : [];
}

function evidence(value: unknown): IndieGameTrackingEvidence[] {
  return Array.isArray(value)
    ? value.filter((item): item is IndieGameTrackingEvidence => Boolean(
        item && typeof item === "object" &&
        typeof (item as IndieGameTrackingEvidence).source === "string" &&
        typeof (item as IndieGameTrackingEvidence).url === "string" &&
        typeof (item as IndieGameTrackingEvidence).observedAt === "string",
      ))
    : [];
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function decodeRow(row: Record<string, unknown>): IndieGameTrackingRecord | undefined {
  if (typeof row.title_key !== "string" ||
    typeof row.title !== "string" ||
    typeof row.updated_at !== "string") return undefined;
  const primaryReleaseDate = typeof row.release_date === "string" ? row.release_date : undefined;
  const primaryReleasePlatform = typeof row.release_platform === "string" ? row.release_platform : undefined;
  const primaryEvidenceAt = typeof row.release_evidence_at === "string" ? row.release_evidence_at : undefined;
  const decodedPlatforms = stringArray(parseJson(row.platforms_json));
  const decodedReleaseDates = releaseDates(parseJson(row.release_dates_json))
    .filter((item) => decodedPlatforms.includes(item.platform));
  if (primaryReleaseDate && primaryReleasePlatform &&
    !decodedReleaseDates.some((item) => item.platform === primaryReleasePlatform)) {
    decodedReleaseDates.push({
      platform: primaryReleasePlatform,
      value: primaryReleaseDate,
      evidenceAt: primaryEvidenceAt,
    });
  }
  return {
    titleKey: row.title_key,
    title: row.title,
    platforms: decodedPlatforms,
    prices: prices(parseJson(row.prices_json)),
    releaseDates: decodedReleaseDates,
    releaseDate: primaryReleaseDate,
    releasePlatform: primaryReleasePlatform,
    releaseEvidenceAt: primaryEvidenceAt,
    evidence: evidence(parseJson(row.evidence_json)),
    lastCheckedAt: typeof row.last_checked_at === "string" ? row.last_checked_at : undefined,
    updatedAt: row.updated_at,
  };
}

function orderedPlatforms(values: Iterable<string>): string[] {
  const unique = new Set(values);
  const known = PLATFORM_ORDER.filter((platform) => unique.delete(platform));
  return [...known, ...unique];
}

function releasePriority(platform?: string): number {
  if (!platform) return RELEASE_PRIORITY.length;
  const index = RELEASE_PRIORITY.indexOf(platform as typeof RELEASE_PRIORITY[number]);
  return index === -1 ? RELEASE_PRIORITY.length : index;
}

function mergeRecord(
  current: IndieGameTrackingRecord | undefined,
  update: IndieGameTrackingUpdate,
  now: string,
): IndieGameTrackingRecord {
  const mergedPrices = new Map<string, string>();
  for (const price of current?.prices ?? []) mergedPrices.set(price.platform, price.value);
  for (const price of update.prices ?? []) mergedPrices.set(price.platform, price.value);

  const mergedEvidence = new Map<string, IndieGameTrackingEvidence>();
  for (const item of current?.evidence ?? []) mergedEvidence.set(item.url, item);
  mergedEvidence.set(update.evidence.url, update.evidence);
  const evidenceItems = [...mergedEvidence.values()]
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, 24);

  const mergedReleaseDates = new Map<string, TopicReleaseDate & { evidenceAt?: string }>();
  for (const item of current?.releaseDates ?? []) mergedReleaseDates.set(item.platform, item);
  const updateReleaseDates = [...(update.releaseDates ?? [])];
  if (update.releaseDate && update.releasePlatform &&
    !updateReleaseDates.some((item) => item.platform === update.releasePlatform)) {
    updateReleaseDates.push({ platform: update.releasePlatform, value: update.releaseDate });
  }
  for (const item of updateReleaseDates) {
    const existing = mergedReleaseDates.get(item.platform);
    if (!existing?.evidenceAt || update.evidence.observedAt >= existing.evidenceAt) {
      mergedReleaseDates.set(item.platform, {
        ...item,
        evidenceAt: update.evidence.observedAt,
      });
    }
  }
  const mergedPlatforms = orderedPlatforms([...(current?.platforms ?? []), ...update.platforms]);

  let releaseDate = current?.releaseDate;
  let releasePlatform = current?.releasePlatform;
  let releaseEvidenceAt = current?.releaseEvidenceAt;
  if (update.releaseDate && update.releasePlatform) {
    const currentPriority = releasePriority(releasePlatform);
    const nextPriority = releasePriority(update.releasePlatform);
    const newerEvidence = !releaseEvidenceAt || update.evidence.observedAt >= releaseEvidenceAt;
    if (!releaseDate || nextPriority < currentPriority ||
      (nextPriority === currentPriority && newerEvidence)) {
      releaseDate = update.releaseDate;
      releasePlatform = update.releasePlatform;
      releaseEvidenceAt = update.evidence.observedAt;
    }
  }
  const orderedReleaseDates = orderedPlatforms(mergedReleaseDates.keys()).flatMap((platform) => {
    const item = mergedReleaseDates.get(platform);
    return item ? [item] : [];
  }).filter((item) => mergedPlatforms.includes(item.platform));
  const primaryRelease = [...orderedReleaseDates].sort(
    (a, b) => releasePriority(a.platform) - releasePriority(b.platform),
  )[0];
  if (primaryRelease) {
    releaseDate = primaryRelease.value;
    releasePlatform = primaryRelease.platform;
    releaseEvidenceAt = primaryRelease.evidenceAt;
  }

  return {
    titleKey: update.titleKey,
    title: update.title || current?.title || update.titleKey,
    platforms: mergedPlatforms,
    prices: orderedPlatforms(mergedPrices.keys()).flatMap((platform) => {
      const value = mergedPrices.get(platform);
      return value ? [{ platform, value }] : [];
    }),
    releaseDates: orderedReleaseDates,
    releaseDate,
    releasePlatform,
    releaseEvidenceAt,
    evidence: evidenceItems,
    lastCheckedAt: current?.lastCheckedAt,
    updatedAt: now,
  };
}

export function listIndieGameTracking(): IndieGameTrackingRecord[] {
  const database = openDatabase();
  try {
    return database
      .prepare("SELECT * FROM indie_game_tracking")
      .all()
      .flatMap((row) => {
        const decoded = decodeRow(row);
        return decoded ? [decoded] : [];
      });
  } finally {
    database.close();
  }
}

export function mergeIndieGameTracking(updates: IndieGameTrackingUpdate[]): void {
  if (updates.length === 0) return;
  const database = openDatabase();
  const select = database.prepare("SELECT * FROM indie_game_tracking WHERE title_key = ?");
  const upsert = database.prepare(`
    INSERT INTO indie_game_tracking (
      title_key, title, platforms_json, prices_json, release_dates_json, release_date,
      release_platform, release_evidence_at, evidence_json, last_checked_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(title_key) DO UPDATE SET
      title = excluded.title,
      platforms_json = excluded.platforms_json,
      prices_json = excluded.prices_json,
      release_dates_json = excluded.release_dates_json,
      release_date = excluded.release_date,
      release_platform = excluded.release_platform,
      release_evidence_at = excluded.release_evidence_at,
      evidence_json = excluded.evidence_json,
      last_checked_at = excluded.last_checked_at,
      updated_at = excluded.updated_at
  `);
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const update of updates) {
      const currentRow = select.get(update.titleKey);
      const current = currentRow ? decodeRow(currentRow) : undefined;
      const merged = mergeRecord(current, update, new Date().toISOString());
      upsert.run(
        merged.titleKey,
        merged.title,
        JSON.stringify(merged.platforms),
        JSON.stringify(merged.prices),
        JSON.stringify(merged.releaseDates),
        merged.releaseDate ?? null,
        merged.releasePlatform ?? null,
        merged.releaseEvidenceAt ?? null,
        JSON.stringify(merged.evidence),
        merged.lastCheckedAt ?? null,
        merged.updatedAt,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

export function markIndieGameTrackingChecked(titleKeys: string[]): void {
  if (titleKeys.length === 0) return;
  const database = openDatabase();
  const statement = database.prepare(`
    UPDATE indie_game_tracking
    SET last_checked_at = ?, updated_at = ?
    WHERE title_key = ?
  `);
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const titleKey of titleKeys) statement.run(now, now, titleKey);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}
