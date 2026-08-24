import type { BoxingEvent } from "@/types";
import type { TopicBoard } from "@/types/topics";

const STORAGE_KEY = "signal-board-checked-cards-v1";
const SNAPSHOT_STORAGE_KEY = "signal-board-checked-card-snapshots-v1";
const SQLITE_MIGRATION_KEY_PREFIX = "signal-board-checked-cards-sqlite-migrated-v2";

export const CHECKED_CARD_SCOPES = [
  "indie-game",
  "movie",
  "boxing",
  "redevelopment",
] as const;
export type CheckedCardScope = typeof CHECKED_CARD_SCOPES[number];
export type CheckedCardItem = TopicBoard | BoxingEvent;
export type CheckedCardSnapshots = Record<string, CheckedCardItem>;

export function checkedCardKey(scope: string, id: string): string {
  return `${scope}:${id}`;
}

export function checkedCardItemKey(
  scope: CheckedCardScope,
  item: CheckedCardItem,
): string {
  const identity = scope === "boxing"
    ? (item as BoxingEvent).id
    : (item as TopicBoard).sourceUrl ?? item.id;
  return checkedCardKey(scope, identity);
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
      Object.entries(parsed).filter(([, value]) => isCheckedCardItemSnapshot(value)),
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

export function replaceCheckedCardScope(
  scope: CheckedCardScope,
  keys: string[],
  snapshots: CheckedCardSnapshots,
): void {
  const prefix = `${scope}:`;
  const retainedKeys = readCheckedCardKeys().filter((key) => !key.startsWith(prefix));
  const scopedKeys = keys.filter((key) => key.startsWith(prefix));
  writeCheckedCardKeys([...new Set([...retainedKeys, ...scopedKeys])]);

  const nextSnapshots = readCheckedCardSnapshots();
  for (const key of Object.keys(nextSnapshots)) {
    if (key.startsWith(prefix)) delete nextSnapshots[key];
  }
  for (const [key, item] of Object.entries(snapshots)) {
    if (key.startsWith(prefix)) nextSnapshots[key] = item;
  }
  writeCheckedCardSnapshots(nextSnapshots);
}

export function hasCheckedCardsSqliteMigration(scope: CheckedCardScope): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`${SQLITE_MIGRATION_KEY_PREFIX}:${scope}`) === "1";
  } catch {
    return false;
  }
}

export function markCheckedCardsSqliteMigration(scope: CheckedCardScope): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${SQLITE_MIGRATION_KEY_PREFIX}:${scope}`, "1");
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
    typeof item.status === "string" &&
    typeof item.statusLabel === "string" &&
    typeof item.statusTone === "string" &&
    typeof item.dateLabel === "string" &&
    typeof item.location === "string" &&
    typeof item.region === "string" &&
    typeof item.summary === "string" &&
    typeof item.image === "string" &&
    Array.isArray(item.metrics) &&
    Array.isArray(item.updates) &&
    Array.isArray(item.tags);
}

export function isBoxingEventSnapshot(value: unknown): value is BoxingEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<BoxingEvent>;
  return typeof event.id === "string" &&
    typeof event.date === "string" &&
    typeof event.name === "string" &&
    typeof event.venue === "string" &&
    typeof event.city === "string" &&
    typeof event.domestic === "boolean" &&
    Array.isArray(event.bouts);
}

export function isCheckedCardItemSnapshot(value: unknown): value is CheckedCardItem {
  return isTopicBoardSnapshot(value) || isBoxingEventSnapshot(value);
}

export function isCheckedCardScope(value: unknown): value is CheckedCardScope {
  return typeof value === "string" &&
    (CHECKED_CARD_SCOPES as readonly string[]).includes(value);
}

export function isCheckedCardKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 2_000;
}

export function isCheckedCardItemForScope(
  scope: CheckedCardScope,
  value: unknown,
): value is CheckedCardItem {
  if (scope === "boxing") return isBoxingEventSnapshot(value);
  return isTopicBoardSnapshot(value) && value.domain === scope;
}
