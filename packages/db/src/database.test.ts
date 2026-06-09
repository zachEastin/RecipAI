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
      { date: "2026-06-08", recipeId: recipe.id, locked: false },
      { date: "2026-06-09", recipeId: recipe.id, locked: true }
    ]);

    expect(listMealPlanEntries(db, "2026-06-08", "2026-06-09")).toHaveLength(2);
    expect(setMealPlanLocked(db, "2026-06-08", true)?.locked).toBe(true);
    clearMealPlanRange(db, "2026-06-08", "2026-06-09");
    expect(listMealPlanEntries(db, "2026-06-08", "2026-06-09")).toHaveLength(0);
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
      { date: "2026-06-08", recipeId: riceBowls.id, locked: false },
      { date: "2026-06-09", recipeId: tomatoSoup.id, locked: true }
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
