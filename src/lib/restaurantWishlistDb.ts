import { openSignalBoardDatabase } from "@/lib/signalBoardDb";
import type { RestaurantWishlistRecord } from "@/types/restaurant";

const SELECT_FIELDS = `
  tabelog_id, url, name, prefecture, address, genres_json, score, review_count,
  tabelog_save_count, budget, seats, opened_on, status, reservation, facility,
  image_url, added_at, updated_at
`;

function openDatabase() {
  const database = openSignalBoardDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS restaurant_wishlist (
      tabelog_id TEXT PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      prefecture TEXT,
      address TEXT,
      genres_json TEXT NOT NULL DEFAULT '[]',
      score REAL,
      review_count INTEGER,
      tabelog_save_count INTEGER,
      budget TEXT,
      seats INTEGER,
      opened_on TEXT,
      status TEXT,
      reservation TEXT,
      facility TEXT,
      image_url TEXT,
      added_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS restaurant_wishlist_added_idx
      ON restaurant_wishlist (added_at DESC);
  `);
  const columns = database.prepare("PRAGMA table_info(restaurant_wishlist)").all();
  if (!columns.some((column) => column.name === "image_url")) {
    database.exec("ALTER TABLE restaurant_wishlist ADD COLUMN image_url TEXT");
  }
  return database;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function decodeGenres(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function decodeRow(row: Record<string, unknown>): RestaurantWishlistRecord {
  return {
    tabelogId: String(row.tabelog_id),
    url: String(row.url),
    name: String(row.name),
    prefecture: optionalText(row.prefecture),
    address: optionalText(row.address),
    genres: decodeGenres(row.genres_json),
    score: optionalNumber(row.score),
    reviewCount: optionalNumber(row.review_count),
    tabelogSaveCount: optionalNumber(row.tabelog_save_count),
    budget: optionalText(row.budget),
    seats: optionalNumber(row.seats),
    openedOn: optionalText(row.opened_on),
    status: optionalText(row.status),
    reservation: optionalText(row.reservation),
    facility: optionalText(row.facility),
    imageUrl: optionalText(row.image_url),
    addedAt: String(row.added_at),
    updatedAt: String(row.updated_at),
  };
}

export function listRestaurantWishlist(): RestaurantWishlistRecord[] {
  const database = openDatabase();
  try {
    return database
      .prepare(`SELECT ${SELECT_FIELDS} FROM restaurant_wishlist ORDER BY added_at DESC, name ASC`)
      .all()
      .map(decodeRow);
  } finally {
    database.close();
  }
}

export function deleteRestaurantWishlistItem(tabelogId: string): boolean {
  const database = openDatabase();
  try {
    const result = database
      .prepare("DELETE FROM restaurant_wishlist WHERE tabelog_id = ?")
      .run(tabelogId) as { changes: number | bigint };
    return Number(result.changes) > 0;
  } finally {
    database.close();
  }
}
