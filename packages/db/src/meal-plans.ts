import type Database from "better-sqlite3";

import type { Recipe } from "@recipai/recipes";

import { getRecipeById } from "./recipes";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

export type MealPlanEntry = {
  date: string;
  mealSlot: MealSlot;
  recipeId: string | null;
  recipe: Recipe | null;
  locked: boolean;
  note: string | null;
  generatedAt: string;
};

type MealPlanRow = {
  plan_date: string;
  meal_slot: MealSlot;
  recipe_id: string | null;
  locked: number;
  note: string | null;
  generated_at: string;
};

export type SaveMealPlanEntryInput = {
  date: string;
  mealSlot: MealSlot;
  recipeId: string;
  locked: boolean;
  note?: string | null;
};

function mapMealPlanRow(db: Database.Database, row: MealPlanRow): MealPlanEntry {
  return {
    date: row.plan_date,
    mealSlot: row.meal_slot,
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
      `SELECT plan_date, meal_slot, recipe_id, locked, note, generated_at
       FROM meal_plans
       WHERE plan_date BETWEEN ? AND ?
       ORDER BY
         plan_date ASC,
         CASE meal_slot
           WHEN 'breakfast' THEN 1
           WHEN 'lunch' THEN 2
           WHEN 'dinner' THEN 3
           ELSE 4
         END ASC`,
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
      `INSERT INTO meal_plans (id, plan_date, meal_slot, recipe_id, locked, note, generated_at)
       VALUES (@id, @date, @mealSlot, @recipeId, @locked, @note, CURRENT_TIMESTAMP)
       ON CONFLICT(plan_date, meal_slot) DO UPDATE SET
         recipe_id = excluded.recipe_id,
         locked = excluded.locked,
         note = excluded.note,
         generated_at = CURRENT_TIMESTAMP`,
    );

    for (const entry of entries) {
      statement.run({
        id: `meal_${entry.date}_${entry.mealSlot}`,
        date: entry.date,
        mealSlot: entry.mealSlot,
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

export function clearMealPlanSlot(
  db: Database.Database,
  date: string,
  mealSlot: MealSlot,
): void {
  db.prepare("DELETE FROM meal_plans WHERE plan_date = ? AND meal_slot = ?").run(date, mealSlot);
}

export function setMealPlanLocked(
  db: Database.Database,
  date: string,
  mealSlot: MealSlot,
  locked: boolean,
): MealPlanEntry | null {
  db.prepare("UPDATE meal_plans SET locked = ? WHERE plan_date = ? AND meal_slot = ?").run(
    locked ? 1 : 0,
    date,
    mealSlot,
  );
  const row = db
    .prepare(
      `SELECT plan_date, meal_slot, recipe_id, locked, note, generated_at
       FROM meal_plans
       WHERE plan_date = ? AND meal_slot = ?`,
    )
    .get(date, mealSlot) as MealPlanRow | undefined;

  return row ? mapMealPlanRow(db, row) : null;
}
