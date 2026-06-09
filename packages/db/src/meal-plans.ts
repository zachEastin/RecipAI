import type Database from "better-sqlite3";

import type { Recipe } from "@recipai/recipes";

import { getRecipeById } from "./recipes";

export type MealPlanEntry = {
  date: string;
  recipeId: string | null;
  recipe: Recipe | null;
  locked: boolean;
  note: string | null;
  generatedAt: string;
};

type MealPlanRow = {
  plan_date: string;
  recipe_id: string | null;
  locked: number;
  note: string | null;
  generated_at: string;
};

export type SaveMealPlanEntryInput = {
  date: string;
  recipeId: string;
  locked: boolean;
  note?: string | null;
};

function mapMealPlanRow(db: Database.Database, row: MealPlanRow): MealPlanEntry {
  return {
    date: row.plan_date,
    recipeId: row.recipe_id,
    recipe: row.recipe_id ? getRecipeById(db, row.recipe_id) : null,
    locked: row.locked === 1,
    note: row.note,
    generatedAt: row.generated_at
  };
}

export function listMealPlanEntries(
  db: Database.Database,
  startDate: string,
  endDate: string,
): MealPlanEntry[] {
  const rows = db
    .prepare(
      `SELECT plan_date, recipe_id, locked, note, generated_at
       FROM meal_plans
       WHERE plan_date BETWEEN ? AND ?
       ORDER BY plan_date ASC`,
    )
    .all(startDate, endDate) as MealPlanRow[];

  return rows.map((row) => mapMealPlanRow(db, row));
}

export function saveMealPlanEntries(
  db: Database.Database,
  entries: SaveMealPlanEntryInput[],
): MealPlanEntry[] {
  const save = db.transaction(() => {
    const statement = db.prepare(
      `INSERT INTO meal_plans (id, plan_date, recipe_id, locked, note, generated_at)
       VALUES (@id, @date, @recipeId, @locked, @note, CURRENT_TIMESTAMP)
       ON CONFLICT(plan_date) DO UPDATE SET
         recipe_id = excluded.recipe_id,
         locked = excluded.locked,
         note = excluded.note,
         generated_at = CURRENT_TIMESTAMP`,
    );

    for (const entry of entries) {
      statement.run({
        id: `meal_${entry.date}`,
        date: entry.date,
        recipeId: entry.recipeId,
        locked: entry.locked ? 1 : 0,
        note: entry.note ?? null
      });
    }
  });

  save();

  if (entries.length === 0) {
    return [];
  }

  const dates = entries.map((entry) => entry.date).sort();
  return listMealPlanEntries(db, dates[0]!, dates.at(-1)!);
}

export function clearMealPlanRange(
  db: Database.Database,
  startDate: string,
  endDate: string,
): void {
  db.prepare("DELETE FROM meal_plans WHERE plan_date BETWEEN ? AND ?").run(startDate, endDate);
}

export function setMealPlanLocked(
  db: Database.Database,
  date: string,
  locked: boolean,
): MealPlanEntry | null {
  db.prepare("UPDATE meal_plans SET locked = ? WHERE plan_date = ?").run(locked ? 1 : 0, date);
  const row = db
    .prepare(
      `SELECT plan_date, recipe_id, locked, note, generated_at
       FROM meal_plans
       WHERE plan_date = ?`,
    )
    .get(date) as MealPlanRow | undefined;

  return row ? mapMealPlanRow(db, row) : null;
}
