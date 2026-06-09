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

export function searchRecipes(db: Database.Database, query: string): Recipe[] {
  const trimmed = query.trim();

  if (!trimmed) {
    return listRecipes(db);
  }

  const rows = db
    .prepare(
      `SELECT r.*
       FROM recipe_search s
       JOIN recipes r ON r.id = s.recipe_id
       WHERE recipe_search MATCH ?
       ORDER BY rank`,
    )
    .all(`${trimmed.replaceAll('"', "")}*`) as RecipeRow[];

  return rows.map((row) => getRecipeById(db, row.id)).filter((recipe) => recipe !== null);
}

export function listRecipeTags(db: Database.Database): string[] {
  const rows = db.prepare("SELECT tags_json FROM recipes").all() as Array<{ tags_json: string }>;
  const tags = new Set<string>();

  for (const row of rows) {
    for (const tag of JSON.parse(row.tags_json) as string[]) {
      tags.add(tag);
    }
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
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

export type SaveRecipeInput = {
  id?: string;
  title: string;
  summary: string;
  source?: string | null;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  rating?: number;
  tags: string[];
  favorite?: boolean;
  imageUrl?: string | null;
  provenance: Recipe["provenance"];
  ingredients: Array<{
    quantity: number | null;
    unit: string | null;
    name: string;
    note: string | null;
    groceryCategory?: string;
  }>;
  steps: Array<{
    body: string;
    timerMinutes: number | null;
  }>;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
}

function uniqueRecipeId(db: Database.Database, title: string, existingId?: string): string {
  if (existingId) {
    return existingId;
  }

  const base = slugify(title) || `recipe-${Date.now()}`;
  let candidate = base;
  let counter = 2;

  while (db.prepare("SELECT 1 FROM recipes WHERE id = ?").get(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function rebuildRecipeSearch(db: Database.Database, recipe: Recipe): void {
  db.prepare("DELETE FROM recipe_search WHERE recipe_id = ?").run(recipe.id);
  db.prepare(
    `INSERT INTO recipe_search (recipe_id, title, summary, source, tags, ingredients, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    recipe.id,
    recipe.title,
    recipe.summary,
    recipe.source ?? "",
    recipe.tags.join(" "),
    recipe.ingredients.map((item) => item.name).join(" "),
    [
      ...recipe.ingredients.map((item) => item.note ?? ""),
      ...recipe.steps.map((step) => step.body)
    ].join(" "),
  );
}

export function rebuildAllRecipeSearch(db: Database.Database): void {
  db.prepare("DELETE FROM recipe_search").run();
  for (const recipe of listRecipes(db)) {
    rebuildRecipeSearch(db, recipe);
  }
}

export function saveRecipe(db: Database.Database, input: SaveRecipeInput): Recipe {
  const id = uniqueRecipeId(db, input.title, input.id);

  const save = db.transaction(() => {
    db.prepare(
      `INSERT INTO recipes (
        id, title, summary, source, servings, prep_minutes, cook_minutes,
        rating, tags_json, favorite, image_url, provenance, updated_at
      ) VALUES (
        @id, @title, @summary, @source, @servings, @prepMinutes, @cookMinutes,
        @rating, @tagsJson, @favorite, @imageUrl, @provenance, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        source = excluded.source,
        servings = excluded.servings,
        prep_minutes = excluded.prep_minutes,
        cook_minutes = excluded.cook_minutes,
        rating = excluded.rating,
        tags_json = excluded.tags_json,
        favorite = excluded.favorite,
        image_url = excluded.image_url,
        provenance = excluded.provenance,
        updated_at = CURRENT_TIMESTAMP`,
    ).run({
      id,
      title: input.title,
      summary: input.summary,
      source: input.source ?? null,
      servings: input.servings,
      prepMinutes: input.prepMinutes,
      cookMinutes: input.cookMinutes,
      rating: input.rating ?? 0,
      tagsJson: JSON.stringify(input.tags),
      favorite: input.favorite ? 1 : 0,
      imageUrl: input.imageUrl ?? null,
      provenance: input.provenance
    });

    db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").run(id);
    db.prepare("DELETE FROM recipe_steps WHERE recipe_id = ?").run(id);

    const insertIngredient = db.prepare(
      `INSERT INTO recipe_ingredients (
        id, recipe_id, quantity, unit, name, note, grocery_category, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertStep = db.prepare(
      `INSERT INTO recipe_steps (id, recipe_id, body, timer_minutes, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
    );

    input.ingredients.forEach((item, index) => {
      insertIngredient.run(
        `${id}-ingredient-${index + 1}`,
        id,
        item.quantity,
        item.unit,
        item.name,
        item.note,
        item.groceryCategory ?? "Other",
        index + 1,
      );
    });

    input.steps.forEach((item, index) => {
      insertStep.run(`${id}-step-${index + 1}`, id, item.body, item.timerMinutes, index + 1);
    });

    const recipe = getRecipeById(db, id);
    if (!recipe) {
      throw new Error("Recipe save failed.");
    }

    rebuildRecipeSearch(db, recipe);
    return recipe;
  });

  return save();
}

export function updateRecipeRating(
  db: Database.Database,
  id: string,
  rating: number,
): Recipe | null {
  db.prepare("UPDATE recipes SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    rating,
    id,
  );
  return getRecipeById(db, id);
}

export function updateRecipeFavorite(
  db: Database.Database,
  id: string,
  favorite: boolean,
): Recipe | null {
  db.prepare("UPDATE recipes SET favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    favorite ? 1 : 0,
    id,
  );
  return getRecipeById(db, id);
}

export function markRecipeCooked(db: Database.Database, id: string, cookedAt: string): Recipe | null {
  db.prepare("UPDATE recipes SET last_cooked_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    cookedAt,
    id,
  );
  return getRecipeById(db, id);
}
