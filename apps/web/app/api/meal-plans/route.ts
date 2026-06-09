import { NextResponse } from "next/server";
import { z } from "zod";

import {
  listMealPlanEntries,
  listRecipes,
  saveMealPlanEntries,
  type SaveMealPlanEntryInput
} from "@recipai/db";
import { dateRangeInclusive, defaultDinnerPlanRange } from "@recipai/meal-planning";

import { openAppDatabase } from "@/lib/server-db";

const entrySchema = z.object({
  date: z.string(),
  recipeId: z.string(),
  locked: z.boolean(),
  note: z.string().nullable().optional()
});

const saveSchema = z.object({
  entries: z.array(entrySchema)
});

function rangeFromUrl(request: Request) {
  const url = new URL(request.url);
  const defaults = defaultDinnerPlanRange();
  return {
    startDate: url.searchParams.get("startDate") ?? defaults.startDate,
    endDate: url.searchParams.get("endDate") ?? defaults.endDate
  };
}

export async function GET(request: Request) {
  const { startDate, endDate } = rangeFromUrl(request);
  const dates = dateRangeInclusive(startDate, endDate);

  if (dates.length === 0) {
    return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    return NextResponse.json({
      startDate,
      endDate,
      dates,
      entries: listMealPlanEntries(db, startDate, endDate),
      recipes: listRecipes(db)
    });
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  const parsed = saveSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Meal plan entries are required." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    const entries: SaveMealPlanEntryInput[] = parsed.data.entries.map((entry) => ({
      date: entry.date,
      recipeId: entry.recipeId,
      locked: entry.locked,
      note: entry.note ?? null
    }));

    return NextResponse.json({ entries: saveMealPlanEntries(db, entries) });
  } finally {
    db.close();
  }
}
