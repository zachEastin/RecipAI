import { describe, expect, it } from "vitest";

import { parseIngredientLine, parseIngredientQuantityInput } from "./ingredient-parser";

describe("ingredient line parser", () => {
  it("parses reported imported ingredient examples into structured fields", () => {
    expect(parseIngredientLine("8 Flakey Buttermilk Biscuits")).toMatchObject({
      quantity: 8,
      unit: null,
      name: "Flakey Buttermilk Biscuits",
      note: null
    });
    expect(parseIngredientLine("1 pound pork sausage")).toMatchObject({
      quantity: 1,
      unit: "lb",
      name: "pork sausage",
      note: null
    });
    expect(parseIngredientLine("2 Tablespoon + 1 teaspoon(s)s all-purpose flour ((18 g))")).toMatchObject({
      quantity: 2.333,
      unit: "tbsp",
      name: "all-purpose flour",
      note: "18 g"
    });
    expect(parseIngredientLine("2 1/2 cups half and half ((600 ml))")).toMatchObject({
      quantity: 2.5,
      unit: "cup",
      name: "half and half",
      note: "600 ml"
    });
    expect(parseIngredientLine("freshly ground black pepper (, to taste)")).toMatchObject({
      quantity: null,
      unit: null,
      name: "freshly ground black pepper",
      note: "to taste"
    });
  });

  it("parses real URL import ingredients from the Cozy Cook ramen recipe", () => {
    expect(parseIngredientLine("½ cup dry white wine")).toMatchObject({
      quantity: 0.5,
      unit: "cup",
      name: "dry white wine"
    });
    expect(parseIngredientLine("¾ teaspoon toasted sesame seed oil")).toMatchObject({
      quantity: 0.75,
      unit: "tsp",
      name: "toasted sesame seed oil"
    });
    expect(parseIngredientLine("2 (3 oz.) packets instant Ramen noodles, don’t use flavor packet")).toMatchObject({
      quantity: 2,
      unit: "packet",
      name: "instant Ramen noodles",
      note: "3 oz.; don’t use flavor packet"
    });
    expect(parseIngredientLine("1 large boneless/skinless chicken breast, about ¾ lb.")).toMatchObject({
      quantity: 1,
      unit: null,
      name: "large boneless/skinless chicken breast",
      note: "about 3/4 lb."
    });
    expect(parseIngredientLine("¾ teaspoon EACH: onion powder, mustard powder")).toMatchObject({
      quantity: 0.75,
      unit: "tsp",
      name: "onion powder, mustard powder",
      note: "each"
    });
    expect(parseIngredientLine("Salt/Pepper")).toMatchObject({
      quantity: null,
      unit: null,
      name: "Salt/Pepper",
      note: null
    });
    expect(parseIngredientLine("Green Onions")).toMatchObject({
      quantity: null,
      unit: null,
      name: "Green Onions",
      note: null
    });
  });

  it("parses amount input values used by structured ingredient rows", () => {
    expect(parseIngredientQuantityInput("2 1/2")).toBe(2.5);
    expect(parseIngredientQuantityInput("¾")).toBe(0.75);
    expect(parseIngredientQuantityInput("1.25")).toBe(1.25);
    expect(parseIngredientQuantityInput("about 1")).toBeNull();
  });
});
