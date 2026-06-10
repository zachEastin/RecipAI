import { describe, expect, it } from "vitest";

import type { Recipe } from "@recipai/recipes";
import { filterRecipes, recipeSearchScore } from "./recipe-filters";

function recipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: "base",
    title: "Base recipe",
    summary: "A simple recipe.",
    source: null,
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    mealSlots: ["dinner"],
    rating: 0,
    tags: [],
    favorite: false,
    lastCookedAt: null,
    imageUrl: null,
    provenance: "manual",
    ingredients: [],
    steps: [],
    ...overrides
  };
}

function ingredient(name: string, recipeId = "base") {
  return {
    id: `${recipeId}-${name}`,
    recipeId,
    quantity: null,
    unit: null,
    name,
    note: null,
    groceryCategory: "other",
    sortOrder: 0
  };
}

describe("recipe filters", () => {
  it("fuzzily matches misspelled recipe searches", () => {
    const score = recipeSearchScore(
      recipe({
        title: "Chicken Parmesan",
        ingredients: [ingredient("chicken breast"), ingredient("tomato sauce")]
      }),
      "chiken parm",
    );

    expect(score).toBeGreaterThan(0);
  });

  it("filters ingredient matches by the selected threshold", () => {
    const recipes = [
      recipe({
        id: "tacos",
        title: "Chicken Tacos",
        ingredients: [ingredient("chicken", "tacos"), ingredient("tortillas", "tacos")]
      }),
      recipe({
        id: "rice",
        title: "Chicken Rice",
        ingredients: [ingredient("chicken", "rice"), ingredient("rice", "rice")]
      })
    ];

    const filtered = filterRecipes(recipes, {
      favoriteOnly: false,
      ingredientThreshold: 2,
      minRating: 0,
      query: "",
      recentOnly: false,
      selectedIngredients: ["chicken", "tortillas"],
      tagFilter: "all"
    });

    expect(filtered.map(({ recipe: item }) => item.id)).toEqual(["tacos"]);
  });

  it("orders ingredient-filtered recipes by match weight", () => {
    const recipes = [
      recipe({
        id: "one",
        title: "Chicken Bowl",
        ingredients: [ingredient("chicken", "one")]
      }),
      recipe({
        id: "three",
        title: "Loaded Chicken Bowl",
        ingredients: [
          ingredient("chicken", "three"),
          ingredient("black beans", "three"),
          ingredient("rice", "three")
        ]
      })
    ];

    const filtered = filterRecipes(recipes, {
      favoriteOnly: false,
      ingredientThreshold: 1,
      minRating: 0,
      query: "",
      recentOnly: false,
      selectedIngredients: ["chicken", "black beans", "rice"],
      tagFilter: "all"
    });

    expect(filtered.map(({ recipe: item }) => item.id)).toEqual(["three", "one"]);
  });
});

