import { NextResponse } from "next/server";
import { z } from "zod";

import { listRecipes } from "@recipai/db";
import {
  dateRangeInclusive,
  generateMealPlan,
  type GenerateMealPlanInput
} from "@recipai/meal-planning";

import { openAppDatabase } from "@/lib/server-db";

const assignmentSchema = z.object({
  date: z.string(),
  mealSlot: z.enum(["breakfast", "lunch", "dinner"]),
  recipeId: z.string(),
  locked: z.boolean()
});

const targetSchema = z.object({
  date: z.string(),
  mealSlot: z.enum(["breakfast", "lunch", "dinner"])
});

const schema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  mealSlots: z.array(z.enum(["breakfast", "lunch", "dinner"])).optional(),
  existingAssignments: z.array(assignmentSchema).optional(),
  rerollTargets: z.array(targetSchema).optional(),
  preserveLocked: z.boolean().optional(),
  fillEmptyOnly: z.boolean().optional(),
  avoidRepeats: z.boolean().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  }

  const dates = dateRangeInclusive(parsed.data.startDate, parsed.data.endDate);
  if (dates.length === 0) {
    return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    const recipes = listRecipes(db);
    const input: GenerateMealPlanInput = {
      dates,
      mealSlots: parsed.data.mealSlots?.length ? parsed.data.mealSlots : ["dinner"],
      recipes: recipes.map((recipe) => ({ id: recipe.id, title: recipe.title }))
    };

    if (parsed.data.existingAssignments) {
      input.existingAssignments = parsed.data.existingAssignments;
    }

    if (parsed.data.rerollTargets) {
      input.rerollTargets = parsed.data.rerollTargets;
    }

    if (parsed.data.preserveLocked !== undefined) {
      input.preserveLocked = parsed.data.preserveLocked;
    }

    if (parsed.data.fillEmptyOnly !== undefined) {
      input.fillEmptyOnly = parsed.data.fillEmptyOnly;
    }

    if (parsed.data.avoidRepeats !== undefined) {
      input.avoidRepeats = parsed.data.avoidRepeats;
    }

    const assignments = generateMealPlan(input);

    return NextResponse.json({ assignments, recipes });
  } finally {
    db.close();
  }
}
