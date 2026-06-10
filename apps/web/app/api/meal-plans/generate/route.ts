import { NextResponse } from "next/server";
import { z } from "zod";

import { listRecipes } from "@recipai/db";
import {
  dateRangeInclusive,
  generateMealPlan,
  type GenerateMealPlanInput,
  type MealSlot
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
  avoidRepeats: z.boolean().optional(),
  avoidRecentMeals: z.boolean().optional(),
  preferQuickWeekdays: z.boolean().optional(),
  addVariety: z.boolean().optional()
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
    const mealSlots: MealSlot[] = parsed.data.mealSlots?.length
      ? parsed.data.mealSlots
      : ["dinner"];
    const missingSlots = mealSlots.filter(
      (mealSlot) => !recipes.some((recipe) => recipe.mealSlots.includes(mealSlot)),
    );

    if (missingSlots.length > 0) {
      return NextResponse.json(
        {
          error: `No saved recipes are marked for ${missingSlots.join(", ")}. Edit recipes to enable those meal slots.`
        },
        { status: 400 },
      );
    }

    const input: GenerateMealPlanInput = {
      dates,
      mealSlots,
      recipes: recipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        mealSlots: recipe.mealSlots,
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
        rating: recipe.rating,
        favorite: recipe.favorite,
        lastCookedAt: recipe.lastCookedAt,
        tags: recipe.tags
      }))
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

    if (parsed.data.avoidRecentMeals !== undefined) {
      input.avoidRecentMeals = parsed.data.avoidRecentMeals;
    }

    if (parsed.data.preferQuickWeekdays !== undefined) {
      input.preferQuickWeekdays = parsed.data.preferQuickWeekdays;
    }

    if (parsed.data.addVariety !== undefined) {
      input.addVariety = parsed.data.addVariety;
    }

    const assignments = generateMealPlan(input);

    return NextResponse.json({ assignments, recipes });
  } finally {
    db.close();
  }
}
