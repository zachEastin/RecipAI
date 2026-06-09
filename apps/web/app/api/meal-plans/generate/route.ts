import { NextResponse } from "next/server";
import { z } from "zod";

import { listRecipes } from "@recipai/db";
import {
  dateRangeInclusive,
  generateDinnerPlan,
  type GenerateDinnerPlanInput
} from "@recipai/meal-planning";

import { openAppDatabase } from "@/lib/server-db";

const assignmentSchema = z.object({
  date: z.string(),
  recipeId: z.string(),
  locked: z.boolean()
});

const schema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  existingAssignments: z.array(assignmentSchema).optional(),
  rerollDates: z.array(z.string()).optional()
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
    const input: GenerateDinnerPlanInput = {
      dates,
      recipes: recipes.map((recipe) => ({ id: recipe.id, title: recipe.title }))
    };

    if (parsed.data.existingAssignments) {
      input.existingAssignments = parsed.data.existingAssignments;
    }

    if (parsed.data.rerollDates) {
      input.rerollDates = parsed.data.rerollDates;
    }

    const assignments = generateDinnerPlan(input);

    return NextResponse.json({ assignments, recipes });
  } finally {
    db.close();
  }
}
