import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DATABASE_DIRECTORY = path.join(process.cwd(), ".signal-board-data");

export const SIGNAL_BOARD_DATABASE_PATH = process.env.SIGNAL_BOARD_DB_PATH
  ? path.resolve(process.env.SIGNAL_BOARD_DB_PATH)
  : path.join(DEFAULT_DATABASE_DIRECTORY, "signal-board.sqlite");

export function openSignalBoardDatabase(): DatabaseSync {
  mkdirSync(path.dirname(SIGNAL_BOARD_DATABASE_PATH), { recursive: true });
  const database = new DatabaseSync(SIGNAL_BOARD_DATABASE_PATH);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
  `);
  return database;
}
