import { describe, expect, it } from "vitest";

import { aggregateIngredients, normalizeIngredientName } from "./index";

describe("shopping list aggregation", () => {
  it("merges ingredients with compatible normalized units", () => {
    const items = aggregateIngredients([
      { quantity: 1, unit: "cup", name: "Rice", groceryCategory: "Grains" },
      { quantity: 2, unit: "cups", name: "rice", groceryCategory: "Grains" }
    ]);

    expect(items).toEqual([
      { quantity: 3, unit: "cup", name: "Rice", groceryCategory: "Grains" }
    ]);
  });

  it("keeps ambiguous unit conversions separate", () => {
    const items = aggregateIngredients([
      { quantity: 1, unit: "cup", name: "tomatoes", groceryCategory: "Produce" },
      { quantity: 14, unit: "oz", name: "tomato", groceryCategory: "Produce" }
    ]);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.unit).sort()).toEqual(["cup", "oz"]);
  });

  it("keeps quantity-free ingredients separate", () => {
    const items = aggregateIngredients([
      { quantity: null, unit: null, name: "salt", groceryCategory: "Pantry" },
      { quantity: null, unit: null, name: "salt", groceryCategory: "Pantry" }
    ]);

    expect(items).toHaveLength(2);
  });

  it("normalizes ingredient names for useful matching", () => {
    expect(normalizeIngredientName("Fresh Tomatoes (diced)")).toBe("tomato");
  });
});
