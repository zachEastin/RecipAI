import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { schemaSql } from "./schema";

export function databasePathFromUrl(databaseUrl = process.env.DATABASE_URL): string {
  const fallback = "file:./data/recipai.sqlite";
  const url = databaseUrl ?? fallback;

  if (!url.startsWith("file:")) {
    throw new Error("Only local file: SQLite DATABASE_URL values are supported.");
  }

  return resolve(process.env.RECIPAI_WORKSPACE_ROOT ?? process.cwd(), url.slice("file:".length));
}

export function openDatabase(databasePath = databasePathFromUrl()): Database.Database {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db: Database.Database): void {
  db.exec(schemaSql);
}
