import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { migrate } from "./database";

describe("database migrations", () => {
  it("apply to an in-memory SQLite database", () => {
    const db = new Database(":memory:");
    migrate(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toContain("recipes");
    expect(tables.map((table) => table.name)).toContain("ai_runs");
    expect(tables.map((table) => table.name)).toContain("shopping_lists");
    db.close();
  });
});
