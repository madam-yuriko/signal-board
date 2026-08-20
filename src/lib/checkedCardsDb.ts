import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { TopicBoard } from "@/types/topics";

export const CHECKED_CARD_SCOPES = ["indie-game"] as const;
export type CheckedCardScope = typeof CHECKED_CARD_SCOPES[number];

export interface StoredCheckedCard {
  key: string;
  item: TopicBoard;
  createdAt: string;
  updatedAt: string;
}

const DATABASE_DIRECTORY = path.join(process.cwd(), ".signal-board-data");
const DATABASE_PATH = path.join(DATABASE_DIRECTORY, "signal-board.sqlite");

function openDatabase(): DatabaseSync {
  mkdirSync(DATABASE_DIRECTORY, { recursive: true });
  const database = new DatabaseSync(DATABASE_PATH);
  database.exec(`
    CREATE TABLE IF NOT EXISTS checked_cards (
      scope TEXT NOT NULL,
      card_key TEXT NOT NULL,
      item_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (scope, card_key)
    );
    CREATE INDEX IF NOT EXISTS checked_cards_scope_updated_idx
      ON checked_cards (scope, updated_at DESC);
  `);
  return database;
}

export function isCheckedCardScope(value: unknown): value is CheckedCardScope {
  return typeof value === "string" &&
    (CHECKED_CARD_SCOPES as readonly string[]).includes(value);
}

export function isCheckedCardKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 2_000;
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

function decodeRow(row: Record<string, unknown>): StoredCheckedCard | undefined {
  if (typeof row.card_key !== "string" ||
    typeof row.item_json !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string") {
    return undefined;
  }
  try {
    const item = JSON.parse(row.item_json) as unknown;
    return isTopicBoardSnapshot(item)
      ? {
          key: row.card_key,
          item,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : undefined;
  } catch {
    return undefined;
  }
}

export function listCheckedCards(scope: CheckedCardScope): StoredCheckedCard[] {
  const database = openDatabase();
  try {
    return database
      .prepare(`
        SELECT card_key, item_json, created_at, updated_at
        FROM checked_cards
        WHERE scope = ?
        ORDER BY updated_at DESC
      `)
      .all(scope)
      .flatMap((row) => {
        const decoded = decodeRow(row);
        return decoded ? [decoded] : [];
      });
  } finally {
    database.close();
  }
}

export function upsertCheckedCard(
  scope: CheckedCardScope,
  key: string,
  item: TopicBoard,
): StoredCheckedCard {
  const database = openDatabase();
  const now = new Date().toISOString();
  try {
    database
      .prepare(`
        INSERT INTO checked_cards (scope, card_key, item_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(scope, card_key) DO UPDATE SET
          item_json = excluded.item_json,
          updated_at = excluded.updated_at
      `)
      .run(scope, key, JSON.stringify(item), now, now);
    return { key, item, createdAt: now, updatedAt: now };
  } finally {
    database.close();
  }
}

export function deleteCheckedCard(scope: CheckedCardScope, key: string): void {
  const database = openDatabase();
  try {
    database.prepare("DELETE FROM checked_cards WHERE scope = ? AND card_key = ?").run(scope, key);
  } finally {
    database.close();
  }
}
