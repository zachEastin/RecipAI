import { z } from "zod";

import { inferRecipeMealSlots } from "@recipai/recipes";
import type { SaveRecipeInput } from "@recipai/db";

export const recipeInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2),
  summary: z.string().trim().min(2),
  source: z.string().trim().nullable().optional(),
  servings: z.number().int().positive(),
  prepMinutes: z.number().int().min(0),
  cookMinutes: z.number().int().min(0),
  mealSlots: z.array(z.enum(["breakfast", "lunch", "dinner"])).optional(),
  rating: z.number().int().min(0).max(5).optional(),
  tags: z.array(z.string().trim().min(1)),
  favorite: z.boolean().optional(),
  imageUrl: z.string().trim().nullable().optional(),
  provenance: z.enum(["seed", "manual", "url-import", "ai-generated", "web-search"]).default("manual"),
  ingredients: z
    .array(
      z.object({
        quantity: z.number().nullable(),
        unit: z.string().nullable(),
        name: z.string().trim().min(1),
        note: z.string().nullable(),
        groceryCategory: z.string().optional()
      }),
    )
    .min(1),
  steps: z
    .array(
      z.object({
        body: z.string().trim().min(1),
        timerMinutes: z.number().int().positive().nullable()
      }),
    )
    .min(1)
});

export function toSaveRecipeInput(value: z.infer<typeof recipeInputSchema>): SaveRecipeInput {
  const input: SaveRecipeInput = {
    title: value.title,
    summary: value.summary,
    source: value.source ?? null,
    servings: value.servings,
    prepMinutes: value.prepMinutes,
    cookMinutes: value.cookMinutes,
    mealSlots: value.mealSlots ?? inferRecipeMealSlots(value),
    tags: value.tags,
    provenance: value.provenance,
    ingredients: value.ingredients.map((ingredient) => ({
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      name: ingredient.name,
      note: ingredient.note,
      groceryCategory: ingredient.groceryCategory ?? "Other"
    })),
    steps: value.steps
  };

  if (value.id) {
    input.id = value.id;
  }

  if (value.rating !== undefined) {
    input.rating = value.rating;
  }

  if (value.favorite !== undefined) {
    input.favorite = value.favorite;
  }

  if (value.imageUrl !== undefined) {
    input.imageUrl = value.imageUrl || null;
  }

  return input;
}
