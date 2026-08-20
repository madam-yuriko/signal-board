import type { TopicBoard } from "@/types/topics";

const STORAGE_KEY = "signal-board-checked-cards-v1";
const SNAPSHOT_STORAGE_KEY = "signal-board-checked-card-snapshots-v1";
const SQLITE_MIGRATION_KEY = "signal-board-checked-cards-sqlite-migrated-v1";

export type CheckedCardSnapshots = Record<string, TopicBoard>;

export function checkedCardKey(scope: string, id: string): string {
  return `${scope}:${id}`;
}

export function readCheckedCardKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeCheckedCardKeys(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function readCheckedCardSnapshots(): CheckedCardSnapshots {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => isTopicBoardSnapshot(value)),
    ) as CheckedCardSnapshots;
  } catch {
    return {};
  }
}

export function writeCheckedCardSnapshots(snapshots: CheckedCardSnapshots): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function hasCheckedCardsSqliteMigration(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SQLITE_MIGRATION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markCheckedCardsSqliteMigration(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SQLITE_MIGRATION_KEY, "1");
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function isTopicBoardSnapshot(value: unknown): value is TopicBoard {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TopicBoard>;
  return typeof item.id === "string" &&
    typeof item.domain === "string" &&
    typeof item.title === "string" &&
    typeof item.category === "string" &&
    typeof item.dateLabel === "string" &&
    typeof item.summary === "string" &&
    Array.isArray(item.metrics) &&
    Array.isArray(item.updates) &&
    Array.isArray(item.tags);
}
