import "server-only";

import { normalizeFighterName } from "@/lib/fighterInfo";
import { openSignalBoardDatabase } from "@/lib/signalBoardDb";

export interface FighterWikipediaStatus {
  fighterKey: string;
  fighterName: string;
  wikipediaUrl?: string;
  checkedAt: string;
}

function openDatabase() {
  const database = openSignalBoardDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS fighter_wikipedia_status (
      fighter_key TEXT PRIMARY KEY,
      fighter_name TEXT NOT NULL,
      wikipedia_url TEXT,
      checked_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS fighter_wikipedia_status_name_idx
      ON fighter_wikipedia_status (fighter_name);
  `);
  return database;
}

export function listFighterWikipediaStatuses(): Record<
  string,
  FighterWikipediaStatus
> {
  const database = openDatabase();
  try {
    const statuses: Record<string, FighterWikipediaStatus> = {};
    for (const row of database
      .prepare(`
        SELECT fighter_key, fighter_name, wikipedia_url, checked_at
        FROM fighter_wikipedia_status
      `)
      .all() as Array<Record<string, unknown>>) {
      if (
        typeof row.fighter_key !== "string" ||
        typeof row.fighter_name !== "string" ||
        typeof row.checked_at !== "string"
      ) {
        continue;
      }
      statuses[row.fighter_key] = {
        fighterKey: row.fighter_key,
        fighterName: row.fighter_name,
        wikipediaUrl:
          typeof row.wikipedia_url === "string" ? row.wikipedia_url : undefined,
        checkedAt: row.checked_at,
      };
    }
    return statuses;
  } finally {
    database.close();
  }
}

export function upsertFighterWikipediaStatus(
  fighterName: string,
  wikipediaUrl?: string,
): FighterWikipediaStatus | undefined {
  const fighterKey = normalizeFighterName(fighterName);
  if (!fighterKey) return undefined;
  const checkedAt = new Date().toISOString();
  const database = openDatabase();
  try {
    database
      .prepare(`
        INSERT INTO fighter_wikipedia_status (
          fighter_key, fighter_name, wikipedia_url, checked_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(fighter_key) DO UPDATE SET
          fighter_name = excluded.fighter_name,
          wikipedia_url = excluded.wikipedia_url,
          checked_at = excluded.checked_at
      `)
      .run(fighterKey, fighterName, wikipediaUrl ?? null, checkedAt);
    return { fighterKey, fighterName, wikipediaUrl, checkedAt };
  } finally {
    database.close();
  }
}
