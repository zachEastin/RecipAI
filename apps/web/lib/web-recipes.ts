import type { Recipe } from "@recipai/recipes";

export type WebRecipeFilterType = "category" | "area" | "ingredient";

export type WebRecipeOption = {
  id: string;
  label: string;
};

export type WebRecipeOptions = {
  areas: WebRecipeOption[];
  categories: WebRecipeOption[];
  ingredients: WebRecipeOption[];
};

export type WebRecipeSearchResult = {
  id: string;
  title: string;
  category: string | null;
  area: string | null;
  thumbnailUrl: string | null;
  tags: string[];
};

export type WebRecipeDraft = {
  sourceId: string;
  title: string;
  summary: string;
  source: string | null;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  ingredients: string[];
  steps: string[];
  imageUrl: string | null;
  provenance: Recipe["provenance"];
};

type MealDbListItem = {
  strArea?: string | null;
  strCategory?: string | null;
  strIngredient?: string | null;
};

type MealDbMeal = {
  idMeal: string;
  strMeal: string;
  strDrinkAlternate?: string | null;
  strCategory?: string | null;
  strArea?: string | null;
  strInstructions?: string | null;
  strMealThumb?: string | null;
  strTags?: string | null;
  strYoutube?: string | null;
  strSource?: string | null;
} & Record<`strIngredient${number}` | `strMeasure${number}`, string | null | undefined>;

type MealDbResponse<T> = {
  meals: T[] | null;
};

const BASE_URL = "https://www.themealdb.com/api/json/v1";

function apiKey(): string {
  return process.env.THEMEALDB_API_KEY?.trim() || "1";
}

function mealDbUrl(path: string, params: Record<string, string> = {}): URL {
  const url = new URL(`${BASE_URL}/${apiKey()}/${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

async function fetchMealDb<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const response = await fetch(mealDbUrl(path, params), {
    headers: {
      "User-Agent": "RecipAI local web recipe search"
    }
  });

  if (!response.ok) {
    throw new Error(`Web recipe search returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as MealDbResponse<T>;
  return payload.meals ?? [];
}

function clean(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function option(value: string | null | undefined): WebRecipeOption | null {
  const label = clean(value);
  return label ? { id: label, label } : null;
}

function uniqueOptions(values: Array<string | null | undefined>): WebRecipeOption[] {
  const options = new Map<string, WebRecipeOption>();

  for (const value of values) {
    const next = option(value);
    if (next) {
      options.set(next.id.toLowerCase(), next);
    }
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function tagList(value: string | null | undefined): string[] {
  return clean(value)
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function ingredientLines(meal: MealDbMeal): string[] {
  const lines: string[] = [];

  for (let index = 1; index <= 20; index += 1) {
    const ingredient = clean(meal[`strIngredient${index}`]);
    const measure = clean(meal[`strMeasure${index}`]);

    if (ingredient) {
      lines.push([measure, ingredient].filter(Boolean).join(" "));
    }
  }

  return lines;
}

function instructionLines(value: string | null | undefined): string[] {
  return clean(value)
    .split(/\r?\n+|(?<=\.)\s+(?=[A-Z0-9])/)
    .map((step) => step.replace(/^\d+[.)]\s*/, "").trim())
    .filter((step) => step.length > 1);
}

function mealTags(meal: MealDbMeal): string[] {
  const tags = [
    "web-search",
    clean(meal.strCategory).toLowerCase(),
    clean(meal.strArea).toLowerCase(),
    ...tagList(meal.strTags)
  ].filter(Boolean);

  return [...new Set(tags)];
}

export function mealToSearchResult(meal: MealDbMeal): WebRecipeSearchResult {
  return {
    id: meal.idMeal,
    title: clean(meal.strMeal),
    category: clean(meal.strCategory) || null,
    area: clean(meal.strArea) || null,
    thumbnailUrl: clean(meal.strMealThumb) || null,
    tags: mealTags(meal).filter((tag) => tag !== "web-search").slice(0, 3)
  };
}

export function mealToDraft(meal: MealDbMeal): WebRecipeDraft {
  const category = clean(meal.strCategory);
  const area = clean(meal.strArea);
  const title = clean(meal.strMeal);
  const descriptor = [area, category].filter(Boolean).join(" ").toLowerCase() || "recipe";

  return {
    sourceId: meal.idMeal,
    title,
    summary: `${descriptor[0]?.toUpperCase() ?? "R"}${descriptor.slice(1)} imported from web search.`,
    source: clean(meal.strSource) || clean(meal.strYoutube) || null,
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    tags: mealTags(meal),
    ingredients: ingredientLines(meal),
    steps: instructionLines(meal.strInstructions),
    imageUrl: clean(meal.strMealThumb) || null,
    provenance: "web-search"
  };
}

function matchesFilter(meal: MealDbMeal, filterType: WebRecipeFilterType, filterValue: string): boolean {
  const normalized = filterValue.toLowerCase();

  if (filterType === "category") {
    return clean(meal.strCategory).toLowerCase() === normalized;
  }

  if (filterType === "area") {
    return clean(meal.strArea).toLowerCase() === normalized;
  }

  return ingredientLines(meal).some((line) => line.toLowerCase().includes(normalized));
}

export async function listWebRecipeOptions(): Promise<WebRecipeOptions> {
  const [categories, areas, ingredients] = await Promise.all([
    fetchMealDb<MealDbListItem>("list.php", { c: "list" }),
    fetchMealDb<MealDbListItem>("list.php", { a: "list" }),
    fetchMealDb<MealDbListItem>("list.php", { i: "list" })
  ]);

  return {
    categories: uniqueOptions(categories.map((item) => item.strCategory)),
    areas: uniqueOptions(areas.map((item) => item.strArea)),
    ingredients: uniqueOptions(ingredients.map((item) => item.strIngredient)).slice(0, 250)
  };
}

export async function getWebRecipeDraft(id: string): Promise<WebRecipeDraft | null> {
  const meals = await fetchMealDb<MealDbMeal>("lookup.php", { i: id });
  const meal = meals[0];

  return meal ? mealToDraft(meal) : null;
}

export async function searchWebRecipes({
  area,
  category,
  ingredientFilters,
  query,
  filterType,
  filterValue
}: {
  area?: string;
  category?: string;
  ingredientFilters?: string[];
  query: string;
  filterType?: WebRecipeFilterType;
  filterValue?: string;
}): Promise<WebRecipeSearchResult[]> {
  const trimmedQuery = query.trim();
  const trimmedFilter = filterValue?.trim() ?? "";
  const selectedCategory = category?.trim() || (filterType === "category" ? trimmedFilter : "");
  const selectedArea = area?.trim() || (filterType === "area" ? trimmedFilter : "");
  const selectedIngredients = [
    ...(ingredientFilters ?? []),
    ...(filterType === "ingredient" && trimmedFilter ? [trimmedFilter] : [])
  ]
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);

  async function hydrateResults(meals: MealDbMeal[]): Promise<MealDbMeal[]> {
    const hydrated = await Promise.all(
      meals.slice(0, 25).map(async (meal) => {
        const fullMeal = await getMealById(meal.idMeal);
        return fullMeal ?? meal;
      }),
    );

    return hydrated;
  }

  function matchesSelectedFilters(meal: MealDbMeal): boolean {
    if (selectedCategory && !matchesFilter(meal, "category", selectedCategory)) {
      return false;
    }

    if (selectedArea && !matchesFilter(meal, "area", selectedArea)) {
      return false;
    }

    return selectedIngredients.every((ingredient) => matchesFilter(meal, "ingredient", ingredient));
  }

  if (!trimmedQuery) {
    let compactMeals: MealDbMeal[] = [];

    if (selectedCategory) {
      compactMeals = await fetchMealDb<MealDbMeal>("filter.php", { c: selectedCategory });
    } else if (selectedArea) {
      compactMeals = await fetchMealDb<MealDbMeal>("filter.php", { a: selectedArea });
    } else if (selectedIngredients[0]) {
      compactMeals = await fetchMealDb<MealDbMeal>("filter.php", { i: selectedIngredients[0] });
    }

    if (!compactMeals.length) {
      return [];
    }

    const selectedFilterCount =
      (selectedCategory ? 1 : 0) + (selectedArea ? 1 : 0) + selectedIngredients.length;
    const canUseCompactResults = selectedFilterCount === 1;

    if (canUseCompactResults) {
      return compactMeals.slice(0, 25).map(mealToSearchResult);
    }

    const hydratedMeals = await hydrateResults(compactMeals);
    return hydratedMeals.filter(matchesSelectedFilters).slice(0, 25).map(mealToSearchResult);
  }

  const meals = await fetchMealDb<MealDbMeal>("search.php", { s: trimmedQuery });
  const filteredMeals = meals.filter(matchesSelectedFilters);

  return filteredMeals.slice(0, 25).map(mealToSearchResult);
}

async function getMealById(id: string): Promise<MealDbMeal | null> {
  const meals = await fetchMealDb<MealDbMeal>("lookup.php", { i: id });
  return meals[0] ?? null;
}
