import {
  isCheckedCardItemForScope,
  type CheckedCardItem,
  type CheckedCardScope,
} from "@/lib/checkedCards";
import { openSignalBoardDatabase } from "@/lib/signalBoardDb";

export interface StoredCheckedCard {
  key: string;
  item: CheckedCardItem;
  createdAt: string;
  updatedAt: string;
}

function openDatabase() {
  const database = openSignalBoardDatabase();
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

function decodeRow(
  row: Record<string, unknown>,
  scope: CheckedCardScope,
): StoredCheckedCard | undefined {
  if (typeof row.card_key !== "string" ||
    typeof row.item_json !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string") {
    return undefined;
  }
  try {
    const item = JSON.parse(row.item_json) as unknown;
    return isCheckedCardItemForScope(scope, item)
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
        const decoded = decodeRow(row, scope);
        return decoded ? [decoded] : [];
      });
  } finally {
    database.close();
  }
}

export function upsertCheckedCard(
  scope: CheckedCardScope,
  key: string,
  item: CheckedCardItem,
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
