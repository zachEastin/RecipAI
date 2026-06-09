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
  migrateMealPlans(db);
  migrateRecipeSearch(db);
}

function migrateMealPlans(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(meal_plans)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (columnNames.has("meal_slot")) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE meal_plans RENAME TO meal_plans_old;

      CREATE TABLE meal_plans (
        id TEXT PRIMARY KEY,
        plan_date TEXT NOT NULL,
        meal_slot TEXT NOT NULL DEFAULT 'dinner',
        recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
        locked INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(plan_date, meal_slot)
      );

      INSERT INTO meal_plans (id, plan_date, meal_slot, recipe_id, locked, note, generated_at)
      SELECT
        'meal_' || plan_date || '_dinner',
        plan_date,
        'dinner',
        recipe_id,
        locked,
        note,
        generated_at
      FROM meal_plans_old;

      DROP TABLE meal_plans_old;
    `);
  })();
}

function migrateRecipeSearch(db: Database.Database): void {
  const columns = db
    .prepare("PRAGMA table_info(recipe_search)")
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (columnNames.has("source") && columnNames.has("notes")) {
    const recipeCount = (db.prepare("SELECT COUNT(*) AS count FROM recipes").get() as {
      count: number;
    }).count;
    const searchCount = (db.prepare("SELECT COUNT(*) AS count FROM recipe_search").get() as {
      count: number;
    }).count;

    if (recipeCount > 0 && searchCount === 0) {
      rebuildRecipeSearchFromTables(db);
    }

    return;
  }

  db.exec(`
    DROP TABLE IF EXISTS recipe_search;
    CREATE VIRTUAL TABLE recipe_search USING fts5(
      recipe_id UNINDEXED,
      title,
      summary,
      source,
      tags,
      ingredients,
      notes
    );
  `);

  rebuildRecipeSearchFromTables(db);
}

function rebuildRecipeSearchFromTables(db: Database.Database): void {
  db.prepare("DELETE FROM recipe_search").run();

  const recipeRows = db
    .prepare("SELECT id, title, summary, source, tags_json FROM recipes")
    .all() as Array<{
    id: string;
    title: string;
    summary: string;
    source: string | null;
    tags_json: string;
  }>;

  const ingredients = db.prepare(
    "SELECT name, note FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC",
  );
  const steps = db.prepare("SELECT body FROM recipe_steps WHERE recipe_id = ? ORDER BY sort_order ASC");
  const insert = db.prepare(
    `INSERT INTO recipe_search (recipe_id, title, summary, source, tags, ingredients, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const recipe of recipeRows) {
    const ingredientRows = ingredients.all(recipe.id) as Array<{
      name: string;
      note: string | null;
    }>;
    const stepRows = steps.all(recipe.id) as Array<{ body: string }>;

    insert.run(
      recipe.id,
      recipe.title,
      recipe.summary,
      recipe.source ?? "",
      (JSON.parse(recipe.tags_json) as string[]).join(" "),
      ingredientRows.map((item) => item.name).join(" "),
      [
        ...ingredientRows.map((item) => item.note ?? ""),
        ...stepRows.map((item) => item.body)
      ].join(" "),
    );
  }
}
