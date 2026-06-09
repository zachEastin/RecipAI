import type Database from "better-sqlite3";

import { migrate, openDatabase } from "@recipai/db";

import { loadLocalEnv } from "./local-env";

export function openAppDatabase(): Database.Database {
  loadLocalEnv();
  const db = openDatabase();
  migrate(db);
  return db;
}
