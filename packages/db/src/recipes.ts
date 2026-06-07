import type Database from "better-sqlite3";

import type { Recipe, RecipeIngredient, RecipeStep } from "@recipai/recipes";

type RecipeRow = {
  id: string;
  title: string;
  summary: string;
  source: string | null;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  rating: number;
  tags_json: string;
  favorite: number;
  last_cooked_at: string | null;
  image_url: string | null;
  provenance: Recipe["provenance"];
};

type IngredientRow = {
  id: string;
  recipe_id: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  note: string | null;
  grocery_category: string;
  sort_order: number;
};

type StepRow = {
  id: string;
  recipe_id: string;
  body: string;
  timer_minutes: number | null;
  sort_order: number;
};

function mapIngredient(row: IngredientRow): RecipeIngredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    quantity: row.quantity,
    unit: row.unit,
    name: row.name,
    note: row.note,
    groceryCategory: row.grocery_category,
    sortOrder: row.sort_order
  };
}

function mapStep(row: StepRow): RecipeStep {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    body: row.body,
    timerMinutes: row.timer_minutes,
    sortOrder: row.sort_order
  };
}

function mapRecipe(
  row: RecipeRow,
  ingredients: RecipeIngredient[],
  steps: RecipeStep[],
): Recipe {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    source: row.source,
    servings: row.servings,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    rating: row.rating,
    tags: JSON.parse(row.tags_json) as string[],
    favorite: row.favorite === 1,
    lastCookedAt: row.last_cooked_at,
    imageUrl: row.image_url,
    provenance: row.provenance,
    ingredients,
    steps
  };
}

export function listRecipes(db: Database.Database): Recipe[] {
  const rows = db
    .prepare("SELECT * FROM recipes ORDER BY favorite DESC, rating DESC, title ASC")
    .all() as RecipeRow[];

  return rows.map((row) => getRecipeById(db, row.id)).filter((recipe) => recipe !== null);
}

export function getRecipeById(db: Database.Database, id: string): Recipe | null {
  const row = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id) as
    | RecipeRow
    | undefined;

  if (!row) {
    return null;
  }

  const ingredients = db
    .prepare("SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC")
    .all(id) as IngredientRow[];
  const steps = db
    .prepare("SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY sort_order ASC")
    .all(id) as StepRow[];

  return mapRecipe(row, ingredients.map(mapIngredient), steps.map(mapStep));
}
