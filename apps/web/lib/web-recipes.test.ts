import { afterEach, describe, expect, it, vi } from "vitest";

import {
  mealToDraft,
  mealToSearchResult,
  searchWebRecipes,
  type WebRecipeFilterType
} from "./web-recipes";

const teriyakiMeal = {
  idMeal: "52772",
  strMeal: "Teriyaki Chicken Casserole",
  strCategory: "Chicken",
  strArea: "Japanese",
  strInstructions:
    "Mix soy sauce and garlic. Add chicken and marinate.\nBake until cooked through.",
  strMealThumb: "https://example.com/teriyaki.jpg",
  strTags: "Teriyaki,Soy Sauce,Casserole",
  strYoutube: "https://youtube.example/video",
  strSource: "",
  strIngredient1: "chicken thighs",
  strMeasure1: "2 lbs",
  strIngredient2: "soy sauce",
  strMeasure2: "1/2 cup",
  strIngredient3: "",
  strMeasure3: "",
  strIngredient4: null,
  strMeasure4: null
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web recipe adapter", () => {
  it("normalizes TheMealDB meals into compact search results", () => {
    expect(mealToSearchResult(teriyakiMeal).tags).toEqual([
      "chicken",
      "japanese",
      "teriyaki"
    ]);
  });

  it("normalizes TheMealDB meals into saveable drafts", () => {
    const draft = mealToDraft(teriyakiMeal);

    expect(draft).toMatchObject({
      title: "Teriyaki Chicken Casserole",
      summary: "Japanese chicken imported from web search.",
      source: "https://youtube.example/video",
      provenance: "web-search"
    });
    expect(draft.ingredients).toEqual(["2 lbs chicken thighs", "1/2 cup soy sauce"]);
    expect(draft.steps).toEqual([
      "Mix soy sauce and garlic.",
      "Add chicken and marinate.",
      "Bake until cooked through."
    ]);
  });

  it("uses filter-only search when there is no text query", async () => {
    const fetchMock = vi.fn(async () => Response.json({ meals: [teriyakiMeal] }));
    vi.stubGlobal("fetch", fetchMock);

    const recipes = await searchWebRecipes({
      query: "",
      filterType: "area",
      filterValue: "Japanese"
    });

    expect(String(fetchMock.mock.calls.at(0)?.at(0))).toContain("filter.php?a=Japanese");
    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.title).toBe("Teriyaki Chicken Casserole");
  });

  it("narrows text search results locally when a filter is selected", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        meals: [
          teriyakiMeal,
          {
            ...teriyakiMeal,
            idMeal: "2",
            strMeal: "Beef Tacos",
            strArea: "Mexican",
            strCategory: "Beef",
            strIngredient1: "beef"
          }
        ]
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const recipes = await searchWebRecipes({
      query: "chicken",
      filterType: "area" as WebRecipeFilterType,
      filterValue: "Japanese"
    });

    expect(recipes.map((recipe) => recipe.title)).toEqual(["Teriyaki Chicken Casserole"]);
  });

  it("hydrates single-ingredient results to apply multiple ingredient filters", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      const value = String(url);

      if (value.includes("filter.php")) {
        return Response.json({
          meals: [
            { idMeal: "52772", strMeal: "Teriyaki Chicken Casserole" },
            { idMeal: "2", strMeal: "Plain Chicken" }
          ]
        });
      }

      if (value.includes("lookup.php?i=52772")) {
        return Response.json({ meals: [teriyakiMeal] });
      }

      return Response.json({
        meals: [
          {
            ...teriyakiMeal,
            idMeal: "2",
            strMeal: "Plain Chicken",
            strIngredient1: "chicken thighs",
            strMeasure1: "2 lbs",
            strIngredient2: "",
            strMeasure2: ""
          }
        ]
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const recipes = await searchWebRecipes({
      query: "",
      ingredientFilters: ["chicken thighs", "soy sauce"]
    });

    expect(String(fetchMock.mock.calls.at(0)?.at(0))).toContain("filter.php?i=chicken+thighs");
    expect(recipes.map((recipe) => recipe.title)).toEqual(["Teriyaki Chicken Casserole"]);
  });

  it("throws clear errors for failed upstream requests", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("failed", { status: 503 })));

    await expect(searchWebRecipes({ query: "chicken" })).rejects.toThrow(
      "Web recipe search returned HTTP 503.",
    );
  });
});
