import { NextResponse } from "next/server";
import { z } from "zod";

import { listRecipes, saveRecipe, searchRecipes } from "@recipai/db";
import type { SaveRecipeInput } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

const recipeInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2),
  summary: z.string().trim().min(2),
  source: z.string().trim().nullable().optional(),
  servings: z.number().int().positive(),
  prepMinutes: z.number().int().min(0),
  cookMinutes: z.number().int().min(0),
  rating: z.number().int().min(0).max(5).optional(),
  tags: z.array(z.string().trim().min(1)),
  favorite: z.boolean().optional(),
  provenance: z.enum(["seed", "manual", "url-import", "ai-generated"]).default("manual"),
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

function toSaveRecipeInput(value: z.infer<typeof recipeInputSchema>): SaveRecipeInput {
  const input: SaveRecipeInput = {
    title: value.title,
    summary: value.summary,
    source: value.source ?? null,
    servings: value.servings,
    prepMinutes: value.prepMinutes,
    cookMinutes: value.cookMinutes,
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

  return input;
}

export async function GET(request: Request) {
  const db = openAppDatabase();

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const recipes = query ? searchRecipes(db, query) : listRecipes(db);
    return NextResponse.json({ recipes });
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  const parsed = recipeInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Recipe needs a title, ingredients, and steps." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    const recipe = saveRecipe(db, toSaveRecipeInput(parsed.data));
    return NextResponse.json({ recipe });
  } finally {
    db.close();
  }
}
