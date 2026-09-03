import "server-only";

import type { FighterProfile } from "@/lib/fighterProfile";
import { normalizeFighterName } from "@/lib/fighterInfo";
import { openSignalBoardDatabase } from "@/lib/signalBoardDb";

function openDatabase() {
  const database = openSignalBoardDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS fighter_profiles (
      fighter_key TEXT PRIMARY KEY,
      fighter_name TEXT NOT NULL,
      birth_date TEXT,
      stance TEXT,
      birthplace_prefecture TEXT,
      source_url TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS fighter_profiles_name_idx
      ON fighter_profiles (fighter_name);
  `);
  return database;
}

function decodeProfile(row: Record<string, unknown>): FighterProfile | undefined {
  if (
    typeof row.fighter_key !== "string" ||
    typeof row.fighter_name !== "string" ||
    typeof row.source_url !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return undefined;
  }
  const stance =
    row.stance === "オーソドックス" || row.stance === "サウスポー"
      ? row.stance
      : undefined;
  return {
    fighterKey: row.fighter_key,
    fighterName: row.fighter_name,
    birthDate: typeof row.birth_date === "string" ? row.birth_date : undefined,
    stance,
    birthplacePrefecture:
      typeof row.birthplace_prefecture === "string"
        ? row.birthplace_prefecture
        : undefined,
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
  };
}

export function listFighterProfiles(): FighterProfile[] {
  const database = openDatabase();
  try {
    return database
      .prepare(`
        SELECT fighter_key, fighter_name, birth_date, stance,
          birthplace_prefecture, source_url, updated_at
        FROM fighter_profiles
        ORDER BY fighter_name COLLATE NOCASE
      `)
      .all()
      .flatMap((row) => {
        const profile = decodeProfile(row);
        return profile ? [profile] : [];
      });
  } finally {
    database.close();
  }
}

export function upsertFighterProfile(
  profile: Omit<FighterProfile, "fighterKey" | "updatedAt">,
): FighterProfile | undefined {
  const fighterKey = normalizeFighterName(profile.fighterName);
  if (!fighterKey) return undefined;
  const updatedAt = new Date().toISOString();
  const database = openDatabase();
  try {
    database
      .prepare(`
        INSERT INTO fighter_profiles (
          fighter_key, fighter_name, birth_date, stance,
          birthplace_prefecture, source_url, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fighter_key) DO UPDATE SET
          fighter_name = excluded.fighter_name,
          birth_date = excluded.birth_date,
          stance = excluded.stance,
          birthplace_prefecture = excluded.birthplace_prefecture,
          source_url = excluded.source_url,
          updated_at = excluded.updated_at
      `)
      .run(
        fighterKey,
        profile.fighterName,
        profile.birthDate ?? null,
        profile.stance ?? null,
        profile.birthplacePrefecture ?? null,
        profile.sourceUrl,
        updatedAt,
      );
    return { ...profile, fighterKey, updatedAt };
  } finally {
    database.close();
  }
}
