import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AquariumProfile, AquariumRecord } from "@/types/aquarium";

export interface AquariumRecordInput {
  name: string;
  acquiredDate: string;
  store?: string;
  quantity: number;
  unitPrice?: number;
  tank?: string;
  deathDate?: string;
  notes?: string;
  profile: AquariumProfile;
  wikipediaName?: string;
  photo?: Uint8Array;
  photoMime?: string;
  removePhoto?: boolean;
}

const DATABASE_DIRECTORY = path.join(process.cwd(), ".signal-board-data");
const DATABASE_PATH = path.join(DATABASE_DIRECTORY, "signal-board.sqlite");

function openDatabase(): DatabaseSync {
  mkdirSync(DATABASE_DIRECTORY, { recursive: true });
  const database = new DatabaseSync(DATABASE_PATH);
  database.exec(`
    CREATE TABLE IF NOT EXISTS aquarium_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      scientific_name TEXT,
      kind TEXT NOT NULL DEFAULT 'other',
      variety TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      current_count INTEGER NOT NULL DEFAULT 1,
      acquired_date TEXT NOT NULL,
      store TEXT,
      price INTEGER,
      tank TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      end_date TEXT,
      water_temperature TEXT,
      ph TEXT,
      feeding TEXT,
      husbandry TEXT,
      notes TEXT,
      photo BLOB,
      photo_mime TEXT,
      photo_updated_at TEXT,
      taxonomy_group TEXT,
      family_name TEXT,
      profile_summary TEXT,
      max_size TEXT,
      wikipedia_name TEXT,
      source_url TEXT,
      external_image_url TEXT,
      profile_is_manual INTEGER NOT NULL DEFAULT 0,
      profile_updated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS aquarium_records_acquired_date
      ON aquarium_records(acquired_date DESC);
  `);
  const columns = database.prepare("PRAGMA table_info(aquarium_records)").all();
  const additions: Array<[string, string]> = [
    ["taxonomy_group", "TEXT"],
    ["family_name", "TEXT"],
    ["profile_summary", "TEXT"],
    ["max_size", "TEXT"],
    ["wikipedia_name", "TEXT"],
    ["source_url", "TEXT"],
    ["external_image_url", "TEXT"],
    ["profile_is_manual", "INTEGER NOT NULL DEFAULT 0"],
    ["profile_updated_at", "TEXT"],
  ];
  for (const [name, definition] of additions) {
    if (!columns.some((column) => column.name === name)) {
      database.exec(`ALTER TABLE aquarium_records ADD COLUMN ${name} ${definition}`);
    }
  }
  return database;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function decodeRow(row: Record<string, unknown>): AquariumRecord {
  return {
    id: Number(row.id),
    name: String(row.name),
    acquiredDate: String(row.acquired_date),
    store: optionalText(row.store),
    quantity: Number(row.quantity),
    unitPrice: typeof row.price === "number" ? row.price : undefined,
    tank: optionalText(row.tank),
    deathDate: optionalText(row.end_date),
    notes: optionalText(row.notes),
    taxonomyGroup: optionalText(row.taxonomy_group) ?? "未分類",
    familyName: optionalText(row.family_name),
    scientificName: optionalText(row.scientific_name),
    profileSummary: optionalText(row.profile_summary) ?? "生体情報を再取得するには、この記録を保存し直してください。",
    maxSize: optionalText(row.max_size),
    wikipediaName: optionalText(row.wikipedia_name),
    sourceUrl: optionalText(row.source_url),
    externalImageUrl: optionalText(row.external_image_url),
    hasUploadedPhoto: Boolean(row.has_uploaded_photo),
    photoUpdatedAt: optionalText(row.photo_updated_at),
    profileUpdatedAt: optionalText(row.profile_updated_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const SELECT_FIELDS = `
  id, name, scientific_name, acquired_date, store, quantity, price, tank, end_date, notes,
  taxonomy_group, family_name, profile_summary, max_size, wikipedia_name, source_url, external_image_url,
  photo IS NOT NULL AS has_uploaded_photo, photo_updated_at, profile_updated_at,
  created_at, updated_at
`;

export function listAquariumRecords(): AquariumRecord[] {
  const database = openDatabase();
  try {
    return database.prepare(`SELECT ${SELECT_FIELDS} FROM aquarium_records ORDER BY acquired_date DESC, id DESC`)
      .all().map(decodeRow);
  } finally {
    database.close();
  }
}

export function createAquariumRecord(input: AquariumRecordInput): AquariumRecord {
  const database = openDatabase();
  const now = new Date().toISOString();
  try {
    const result = database.prepare(`
      INSERT INTO aquarium_records (
        name, scientific_name, kind, quantity, current_count, acquired_date, store, price, tank,
        status, end_date, notes, photo, photo_mime, photo_updated_at,
        taxonomy_group, family_name, profile_summary, max_size, wikipedia_name, source_url, external_image_url,
        profile_updated_at, created_at, updated_at
      ) VALUES (?, ?, 'other', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.name, input.profile.scientificName ?? null, input.quantity, input.deathDate ? 0 : input.quantity,
      input.acquiredDate, input.store ?? null, input.unitPrice ?? null,
      input.tank ?? null, input.deathDate ? "deceased" : "active",
      input.deathDate ?? null, input.notes ?? null, input.photo ?? null,
      input.photoMime ?? null, input.photo ? now : null,
      input.profile.taxonomyGroup, input.profile.familyName ?? null, input.profile.summary, input.profile.maxSize ?? null,
      input.wikipediaName ?? null, input.profile.sourceUrl ?? null, input.profile.imageUrl ?? null,
      now, now, now,
    ) as { lastInsertRowid: number | bigint };
    const row = database.prepare(`SELECT ${SELECT_FIELDS} FROM aquarium_records WHERE id = ?`).get(result.lastInsertRowid);
    if (!row) throw new Error("作成した記録を読み込めませんでした。");
    return decodeRow(row);
  } finally {
    database.close();
  }
}

export function updateAquariumRecord(id: number, input: AquariumRecordInput): AquariumRecord | undefined {
  const database = openDatabase();
  const now = new Date().toISOString();
  try {
    const existing = database.prepare("SELECT photo, photo_mime, photo_updated_at FROM aquarium_records WHERE id = ?").get(id);
    if (!existing) return undefined;
    const photo = input.removePhoto ? null : input.photo ?? existing.photo ?? null;
    const photoMime = input.removePhoto ? null : input.photoMime ?? existing.photo_mime ?? null;
    const photoUpdatedAt = input.removePhoto ? null : input.photo ? now : existing.photo_updated_at ?? null;
    database.prepare(`
      UPDATE aquarium_records SET
        name = ?, scientific_name = ?, quantity = ?, current_count = ?, acquired_date = ?, store = ?,
        price = ?, tank = ?, status = ?, end_date = ?, notes = ?, photo = ?,
        photo_mime = ?, photo_updated_at = ?, taxonomy_group = ?, family_name = ?,
        profile_summary = ?, max_size = ?, wikipedia_name = ?, source_url = ?, external_image_url = ?,
        profile_updated_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.name, input.profile.scientificName ?? null, input.quantity, input.deathDate ? 0 : input.quantity,
      input.acquiredDate, input.store ?? null, input.unitPrice ?? null,
      input.tank ?? null, input.deathDate ? "deceased" : "active",
      input.deathDate ?? null, input.notes ?? null, photo, photoMime,
      photoUpdatedAt, input.profile.taxonomyGroup, input.profile.familyName ?? null, input.profile.summary, input.profile.maxSize ?? null,
      input.wikipediaName ?? null, input.profile.sourceUrl ?? null, input.profile.imageUrl ?? null,
      now, now, id,
    );
    const row = database.prepare(`SELECT ${SELECT_FIELDS} FROM aquarium_records WHERE id = ?`).get(id);
    return row ? decodeRow(row) : undefined;
  } finally {
    database.close();
  }
}

export function deleteAquariumRecord(id: number): boolean {
  const database = openDatabase();
  try {
    const result = database.prepare("DELETE FROM aquarium_records WHERE id = ?").run(id) as { changes: number | bigint };
    return Number(result.changes) > 0;
  } finally {
    database.close();
  }
}

export function getAquariumPhoto(id: number): { data: Uint8Array; mime: string; updatedAt?: string } | undefined {
  const database = openDatabase();
  try {
    const row = database.prepare("SELECT photo, photo_mime, photo_updated_at FROM aquarium_records WHERE id = ?").get(id);
    if (!row || !(row.photo instanceof Uint8Array)) return undefined;
    return {
      data: row.photo,
      mime: typeof row.photo_mime === "string" ? row.photo_mime : "image/jpeg",
      updatedAt: optionalText(row.photo_updated_at),
    };
  } finally {
    database.close();
  }
}
