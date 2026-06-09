import { seedRecipes } from "@recipai/recipes";

import { migrate, openDatabase } from "./database";

const db = openDatabase();
migrate(db);

const insertRecipe = db.prepare(`
  INSERT OR REPLACE INTO recipes (
    id, title, summary, source, servings, prep_minutes, cook_minutes,
    rating, tags_json, favorite, last_cooked_at, image_url, provenance, updated_at
  ) VALUES (
    @id, @title, @summary, @source, @servings, @prepMinutes, @cookMinutes,
    @rating, @tagsJson, @favorite, @lastCookedAt, @imageUrl, @provenance, CURRENT_TIMESTAMP
  )
`);

const insertIngredient = db.prepare(`
  INSERT OR REPLACE INTO recipe_ingredients (
    id, recipe_id, quantity, unit, name, note, grocery_category, sort_order
  ) VALUES (
    @id, @recipeId, @quantity, @unit, @name, @note, @groceryCategory, @sortOrder
  )
`);

const insertStep = db.prepare(`
  INSERT OR REPLACE INTO recipe_steps (
    id, recipe_id, body, timer_minutes, sort_order
  ) VALUES (
    @id, @recipeId, @body, @timerMinutes, @sortOrder
  )
`);

const rebuildSearch = db.prepare(`
  INSERT INTO recipe_search (recipe_id, title, summary, source, tags, ingredients, notes)
  VALUES (@recipeId, @title, @summary, @source, @tags, @ingredients, @notes)
`);

const seed = db.transaction(() => {
  db.exec("DELETE FROM recipe_search;");

  for (const recipe of seedRecipes) {
    insertRecipe.run({
      ...recipe,
      tagsJson: JSON.stringify(recipe.tags),
      favorite: recipe.favorite ? 1 : 0
    });

    for (const item of recipe.ingredients) {
      insertIngredient.run(item);
    }

    for (const item of recipe.steps) {
      insertStep.run(item);
    }

    rebuildSearch.run({
      recipeId: recipe.id,
      title: recipe.title,
      summary: recipe.summary,
      source: recipe.source ?? "",
      tags: recipe.tags.join(" "),
      ingredients: recipe.ingredients.map((item) => item.name).join(" "),
      notes: [
        ...recipe.ingredients.map((item) => item.note ?? ""),
        ...recipe.steps.map((item) => item.body)
      ].join(" ")
    });
  }
});

seed();
db.close();

console.log(`Seeded ${seedRecipes.length} recipes.`);
