import type { Recipe } from "@recipai/recipes";

export type RecipeFilterOptions = {
  favoriteOnly: boolean;
  ingredientThreshold: number;
  minRating: number;
  query: string;
  recentOnly: boolean;
  selectedIngredients: string[];
  tagFilter: string;
};

export type FilteredRecipe = {
  ingredientMatchCount: number;
  recipe: Recipe;
  searchScore: number;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? leftIndex) + 1,
        (previous[rightIndex] ?? rightIndex) + 1,
        (previous[rightIndex - 1] ?? rightIndex - 1) + substitutionCost,
      );
    }

    for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
      previous[rightIndex] = current[rightIndex] ?? 0;
    }
  }

  return previous[right.length] ?? 0;
}

function tokenSimilarity(left: string, right: string): number {
  const longestLength = Math.max(left.length, right.length);

  if (longestLength === 0) {
    return 1;
  }

  return 1 - levenshteinDistance(left, right) / longestLength;
}

function tokenScore(queryToken: string, candidateToken: string): number {
  if (candidateToken === queryToken) {
    return 48;
  }

  if (candidateToken.startsWith(queryToken)) {
    return 42;
  }

  if (candidateToken.includes(queryToken)) {
    return 34;
  }

  if (queryToken.length >= 3) {
    const similarity = tokenSimilarity(queryToken, candidateToken);

    if (similarity >= 0.66) {
      return Math.round(28 * similarity);
    }
  }

  return 0;
}

export function recipeSearchScore(recipe: Recipe, query: string): number {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return 0;
  }

  const title = normalize(recipe.title);
  const searchableText = normalize(
    [
      recipe.title,
      recipe.summary,
      recipe.source ?? "",
      ...recipe.tags,
      ...recipe.ingredients.map((ingredient) => ingredient.name),
      ...recipe.ingredients.map((ingredient) => ingredient.note ?? ""),
      ...recipe.steps.map((step) => step.body)
    ].join(" "),
  );

  let score = 0;

  if (title.includes(normalizedQuery)) {
    score += 120;
  } else if (searchableText.includes(normalizedQuery)) {
    score += 85;
  }

  const candidateTokens = tokenize(searchableText);
  const queryTokens = tokenize(query);

  for (const queryToken of queryTokens) {
    const bestTokenScore = Math.max(
      0,
      ...candidateTokens.map((candidateToken) => tokenScore(queryToken, candidateToken)),
    );

    if (bestTokenScore < 18) {
      return 0;
    }

    score += bestTokenScore;
  }

  return score;
}

export function ingredientMatchCount(recipe: Recipe, selectedIngredients: string[]): number {
  if (selectedIngredients.length === 0) {
    return 0;
  }

  const recipeIngredients = recipe.ingredients.map((ingredient) => normalize(ingredient.name));

  return selectedIngredients.reduce((count, selectedIngredient) => {
    const normalizedSelectedIngredient = normalize(selectedIngredient);
    const hasIngredient = recipeIngredients.some(
      (ingredient) =>
        ingredient === normalizedSelectedIngredient ||
        ingredient.includes(normalizedSelectedIngredient) ||
        normalizedSelectedIngredient.includes(ingredient),
    );

    return hasIngredient ? count + 1 : count;
  }, 0);
}

export function filterRecipes(
  recipes: Recipe[],
  {
    favoriteOnly,
    ingredientThreshold,
    minRating,
    query,
    recentOnly,
    selectedIngredients,
    tagFilter
  }: RecipeFilterOptions,
): FilteredRecipe[] {
  const trimmedQuery = query.trim();
  const requiredIngredientMatches =
    selectedIngredients.length > 0 ? Math.min(ingredientThreshold, selectedIngredients.length) : 0;

  return recipes
    .map((recipe) => ({
      ingredientMatchCount: ingredientMatchCount(recipe, selectedIngredients),
      recipe,
      searchScore: recipeSearchScore(recipe, trimmedQuery)
    }))
    .filter(({ ingredientMatchCount: matchCount, recipe, searchScore }) => {
      if (favoriteOnly && !recipe.favorite) {
        return false;
      }

      if (tagFilter !== "all" && !recipe.tags.includes(tagFilter)) {
        return false;
      }

      if (recipe.rating < minRating) {
        return false;
      }

      if (recentOnly && !recipe.lastCookedAt) {
        return false;
      }

      if (trimmedQuery && searchScore === 0) {
        return false;
      }

      if (matchCount < requiredIngredientMatches) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      if (selectedIngredients.length > 0 && left.ingredientMatchCount !== right.ingredientMatchCount) {
        return right.ingredientMatchCount - left.ingredientMatchCount;
      }

      if (trimmedQuery && left.searchScore !== right.searchScore) {
        return right.searchScore - left.searchScore;
      }

      if (left.recipe.favorite !== right.recipe.favorite) {
        return left.recipe.favorite ? -1 : 1;
      }

      if (left.recipe.rating !== right.recipe.rating) {
        return right.recipe.rating - left.recipe.rating;
      }

      return left.recipe.title.localeCompare(right.recipe.title);
    });
}
