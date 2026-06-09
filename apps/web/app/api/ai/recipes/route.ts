import { NextResponse } from "next/server";
import { z } from "zod";

import { aiStructuredResultSchema, type RecipeResult } from "@recipai/ai";
import {
  getRecipeById,
  saveRecipe,
  updateAiRunSaveStatus,
  type SaveRecipeInput
} from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

const schema = z.object({
  action: z.enum(["save-as-new", "replace-original"]),
  result: aiStructuredResultSchema,
  runId: z.string().optional(),
  sourceRecipeId: z.string().optional()
});

function recipeResultFromStructured(result: z.infer<typeof aiStructuredResultSchema>): RecipeResult {
  return result.type === "recipe-modification-result" ? result.updatedRecipe : result;
}

function splitTotalMinutes(totalMinutes: number): { prepMinutes: number; cookMinutes: number } {
  const prepMinutes = Math.min(20, Math.max(0, Math.round(totalMinutes * 0.25)));

  return {
    prepMinutes,
    cookMinutes: Math.max(0, totalMinutes - prepMinutes)
  };
}

function toSaveRecipeInput(
  result: RecipeResult,
  existingId?: string,
): SaveRecipeInput {
  const { prepMinutes, cookMinutes } = splitTotalMinutes(result.totalMinutes);
  const input: SaveRecipeInput = {
    title: result.title,
    summary: result.summary,
    source: null,
    servings: result.servings,
    prepMinutes,
    cookMinutes,
    rating: 0,
    tags: result.tags,
    favorite: false,
    imageUrl: null,
    provenance: "ai-generated",
    ingredients: result.ingredients.map((ingredient) => ({
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      name: ingredient.name,
      note: ingredient.note,
      groceryCategory: "Other"
    })),
    steps: result.steps.map((step) => ({
      body: step.body,
      timerMinutes: step.timerMinutes
    }))
  };

  if (existingId) {
    input.id = existingId;
  }

  return input;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "A structured AI recipe result is required." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    const recipeResult = recipeResultFromStructured(parsed.data.result);
    const replacing = parsed.data.action === "replace-original";

    if (replacing && !parsed.data.sourceRecipeId) {
      return NextResponse.json(
        { error: "Choose the original recipe before replacing it." },
        { status: 400 },
      );
    }

    if (replacing && !getRecipeById(db, parsed.data.sourceRecipeId!)) {
      return NextResponse.json({ error: "Original recipe not found." }, { status: 404 });
    }

    const recipe = saveRecipe(
      db,
      toSaveRecipeInput(recipeResult, replacing ? parsed.data.sourceRecipeId : undefined),
    );

    const run = parsed.data.runId
      ? updateAiRunSaveStatus(db, parsed.data.runId, replacing ? "replaced" : "saved")
      : null;

    return NextResponse.json({ recipe, run });
  } finally {
    db.close();
  }
}
