import { describe, expect, it } from "vitest";

import { seedRecipes } from "./seed-recipes";

describe("seedRecipes", () => {
  it("contains useful dinner recipes with ingredients and steps", () => {
    expect(seedRecipes.length).toBeGreaterThanOrEqual(5);

    for (const recipe of seedRecipes) {
      expect(recipe.title).toBeTruthy();
      expect(recipe.servings).toBeGreaterThan(0);
      expect(recipe.ingredients.length).toBeGreaterThan(2);
      expect(recipe.steps.length).toBeGreaterThan(1);
    }
  });
});
