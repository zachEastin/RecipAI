import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { migrate } from "./database";
import { saveAiRun } from "./ai-runs";

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

  it("persists structured AI runs", () => {
    const db = new Database(":memory:");
    migrate(db);

    const run = saveAiRun(db, {
      provider: "deepseek",
      mode: "general-recipe",
      prompt: "Make dinner.",
      sourceRecipeId: null,
      structuredResponse: {
        type: "recipe-result",
        title: "Rice Dinner",
        summary: "Simple.",
        servings: 4,
        totalMinutes: 20,
        difficulty: "easy",
        tags: ["fast"],
        ingredients: [{ quantity: 1, unit: "cup", name: "rice", note: null }],
        steps: [{ body: "Cook rice.", timerMinutes: 18 }],
        tips: [],
        substitutions: []
      }
    });

    expect(run.id).toMatch(/^ai_/);
    expect(run.structuredResponse.title).toBe("Rice Dinner");
    db.close();
  });
});
