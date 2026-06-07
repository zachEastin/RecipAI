export type RecipeIngredient = {
  id: string;
  recipeId: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  note: string | null;
  groceryCategory: string;
  sortOrder: number;
};

export type RecipeStep = {
  id: string;
  recipeId: string;
  body: string;
  timerMinutes: number | null;
  sortOrder: number;
};

export type Recipe = {
  id: string;
  title: string;
  summary: string;
  source: string | null;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  rating: number;
  tags: string[];
  favorite: boolean;
  lastCookedAt: string | null;
  imageUrl: string | null;
  provenance: "seed" | "manual" | "url-import" | "ai-generated";
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};
