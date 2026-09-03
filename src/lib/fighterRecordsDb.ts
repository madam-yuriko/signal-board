import "server-only";

import { normalizeFighterName } from "@/lib/fighterInfo";
import type { WikipediaFighterRecord } from "@/lib/fighterRecord";
import { openSignalBoardDatabase } from "@/lib/signalBoardDb";

function openDatabase() {
  const database = openSignalBoardDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS fighter_records (
      fighter_key TEXT PRIMARY KEY,
      fighter_name TEXT NOT NULL,
      record_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS fighter_records_name_idx
      ON fighter_records (fighter_name);
  `);
  return database;
}

function isWikipediaFighterRecord(
  value: unknown,
): value is WikipediaFighterRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<WikipediaFighterRecord>;
  return (
    typeof record.fighter === "string" &&
    typeof record.pageTitle === "string" &&
    typeof record.pageUrl === "string" &&
    Array.isArray(record.bouts)
  );
}

export function listFighterRecords(): Record<string, WikipediaFighterRecord> {
  const database = openDatabase();
  try {
    const records: Record<string, WikipediaFighterRecord> = {};
    for (const row of database
      .prepare("SELECT fighter_key, record_json, updated_at FROM fighter_records")
      .all() as Array<Record<string, unknown>>) {
      if (
        typeof row.fighter_key !== "string" ||
        typeof row.record_json !== "string" ||
        typeof row.updated_at !== "string"
      ) {
        continue;
      }
      try {
        const record: unknown = JSON.parse(row.record_json);
        if (isWikipediaFighterRecord(record)) {
          records[row.fighter_key] = { ...record, updatedAt: row.updated_at };
        }
      } catch {
        // 壊れたキャッシュは一覧表示を止めずに読み飛ばす。
      }
    }
    return records;
  } finally {
    database.close();
  }
}

export function upsertFighterRecord(
  record: WikipediaFighterRecord,
): WikipediaFighterRecord | undefined {
  const fighterKey = normalizeFighterName(record.fighter);
  if (!fighterKey || record.bouts.length === 0) return undefined;
  const updatedAt = new Date().toISOString();
  const savedRecord = { ...record, updatedAt };
  const database = openDatabase();
  try {
    database
      .prepare(`
        INSERT INTO fighter_records (
          fighter_key, fighter_name, record_json, updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(fighter_key) DO UPDATE SET
          fighter_name = excluded.fighter_name,
          record_json = excluded.record_json,
          updated_at = excluded.updated_at
      `)
      .run(
        fighterKey,
        record.fighter,
        JSON.stringify(savedRecord),
        updatedAt,
      );
    return savedRecord;
  } finally {
    database.close();
  }
}
