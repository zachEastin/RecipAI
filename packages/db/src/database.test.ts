import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { migrate } from "./database";
import { saveAiRun } from "./ai-runs";
import {
  clearMealPlanRange,
  listMealPlanEntries,
  saveMealPlanEntries,
  setMealPlanLocked
} from "./meal-plans";
import {
  getRecipeById,
  saveRecipe,
  searchRecipes,
  updateRecipeFavorite
} from "./recipes";
import {
  addShoppingListItem,
  clearCompletedShoppingListItems,
  deleteShoppingListItem,
  generateShoppingListFromMealPlan,
  updateShoppingListItem
} from "./shopping-lists";

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

  it("creates, searches, and favorites recipes", () => {
    const db = new Database(":memory:");
    migrate(db);

    const recipe = saveRecipe(db, {
      title: "Garlic Tomato Pasta",
      summary: "Fast pantry pasta.",
      source: "https://example.com/family-pasta",
      servings: 4,
      prepMinutes: 5,
      cookMinutes: 15,
      mealSlots: ["lunch", "dinner"],
      rating: 4,
      tags: ["pasta", "fast"],
      provenance: "manual",
      ingredients: [
        { quantity: 8, unit: "oz", name: "pasta", note: null },
        { quantity: 2, unit: "cloves", name: "garlic", note: null }
      ],
      steps: [
        { body: "Boil pasta.", timerMinutes: 10 },
        { body: "Toss with garlic tomato sauce.", timerMinutes: null }
      ]
    });

    expect(getRecipeById(db, recipe.id)?.title).toBe("Garlic Tomato Pasta");
    expect(getRecipeById(db, recipe.id)?.mealSlots).toEqual(["lunch", "dinner"]);
    expect(searchRecipes(db, "garlic")[0]?.id).toBe(recipe.id);
    expect(searchRecipes(db, "sauce")[0]?.id).toBe(recipe.id);
    expect(searchRecipes(db, "family")[0]?.id).toBe(recipe.id);
    expect(updateRecipeFavorite(db, recipe.id, true)?.favorite).toBe(true);
    db.close();
  });

  it("saves, locks, and clears meal plan entries", () => {
    const db = new Database(":memory:");
    migrate(db);
    const recipe = saveRecipe(db, {
      title: "Rice Bowls",
      summary: "Simple bowls.",
      servings: 4,
      prepMinutes: 5,
      cookMinutes: 20,
      tags: ["fast"],
      provenance: "manual",
      ingredients: [{ quantity: 1, unit: "cup", name: "rice", note: null }],
      steps: [{ body: "Cook rice.", timerMinutes: 18 }]
    });

    saveMealPlanEntries(db, [
      { date: "2026-06-08", mealSlot: "breakfast", recipeId: recipe.id, locked: false },
      { date: "2026-06-08", mealSlot: "dinner", recipeId: recipe.id, locked: true },
      { date: "2026-06-09", mealSlot: "dinner", recipeId: recipe.id, locked: true }
    ]);

    const entries = listMealPlanEntries(db, "2026-06-08", "2026-06-09");
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => `${entry.date}:${entry.mealSlot}`)).toEqual([
      "2026-06-08:breakfast",
      "2026-06-08:dinner",
      "2026-06-09:dinner"
    ]);
    expect(setMealPlanLocked(db, "2026-06-08", "breakfast", true)?.locked).toBe(true);
    clearMealPlanRange(db, "2026-06-08", "2026-06-09");
    expect(listMealPlanEntries(db, "2026-06-08", "2026-06-09")).toHaveLength(0);
    db.close();
  });

  it("migrates existing dinner-only meal plans to dinner slots", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE recipes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        source TEXT,
        servings INTEGER NOT NULL,
        prep_minutes INTEGER NOT NULL,
        cook_minutes INTEGER NOT NULL,
        rating INTEGER NOT NULL DEFAULT 0,
        tags_json TEXT NOT NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        last_cooked_at TEXT,
        image_url TEXT,
        provenance TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE meal_plans (
        id TEXT PRIMARY KEY,
        plan_date TEXT NOT NULL UNIQUE,
        recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
        locked INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO recipes (
        id, title, summary, servings, prep_minutes, cook_minutes, tags_json, provenance
      ) VALUES (
        'recipe_1', 'Rice Bowls', 'Simple bowls.', 4, 5, 20, '[]', 'manual'
      );
      INSERT INTO meal_plans (id, plan_date, recipe_id, locked, note)
      VALUES ('meal_2026-06-08', '2026-06-08', 'recipe_1', 1, 'keep');
    `);

    migrate(db);

    const entries = listMealPlanEntries(db, "2026-06-08", "2026-06-08");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.mealSlot).toBe("dinner");
    expect(entries[0]?.locked).toBe(true);
    expect(getRecipeById(db, "recipe_1")?.mealSlots).toEqual(["dinner"]);
    db.close();
  });

  it("generates editable shopping lists from planned dinners", () => {
    const db = new Database(":memory:");
    migrate(db);
    const riceBowls = saveRecipe(db, {
      title: "Rice Bowls",
      summary: "Simple bowls.",
      servings: 4,
      prepMinutes: 5,
      cookMinutes: 20,
      tags: ["fast"],
      provenance: "manual",
      ingredients: [
        { quantity: 1, unit: "cup", name: "rice", note: null, groceryCategory: "Grains" },
        { quantity: 1, unit: "cup", name: "tomatoes", note: null, groceryCategory: "Produce" }
      ],
      steps: [{ body: "Cook rice.", timerMinutes: 18 }]
    });
    const tomatoSoup = saveRecipe(db, {
      title: "Tomato Soup",
      summary: "Warm soup.",
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 25,
      tags: ["soup"],
      provenance: "manual",
      ingredients: [
        { quantity: 2, unit: "cups", name: "Rice", note: null, groceryCategory: "Grains" },
        { quantity: 14, unit: "oz", name: "tomato", note: null, groceryCategory: "Produce" }
      ],
      steps: [{ body: "Simmer.", timerMinutes: 25 }]
    });

    saveMealPlanEntries(db, [
      { date: "2026-06-08", mealSlot: "breakfast", recipeId: riceBowls.id, locked: false },
      { date: "2026-06-08", mealSlot: "dinner", recipeId: tomatoSoup.id, locked: true }
    ]);

    const list = generateShoppingListFromMealPlan(db, "2026-06-08", "2026-06-09");
    const rice = list.items.find((item) => item.name.toLowerCase() === "rice");
    const tomatoItems = list.items.filter((item) => item.name.toLowerCase().includes("tomato"));

    expect(rice?.quantity).toBe(3);
    expect(rice?.unit).toBe("cup");
    expect(tomatoItems).toHaveLength(2);

    const checked = updateShoppingListItem(db, rice!.id, { checked: true, name: "Jasmine rice" });
    expect(checked?.checked).toBe(true);
    expect(checked?.name).toBe("Jasmine rice");

    const manual = addShoppingListItem(db, list.id, {
      quantity: 1,
      unit: null,
      name: "dish soap",
      groceryCategory: "Household"
    });
    expect(manual?.groceryCategory).toBe("Household");
    expect(deleteShoppingListItem(db, manual!.id)).toBe(true);
    expect(clearCompletedShoppingListItems(db, list.id)).toBe(1);
    db.close();
  });
});
