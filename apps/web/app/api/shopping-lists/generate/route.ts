import { NextResponse } from "next/server";
import { z } from "zod";

import { generateShoppingListFromMealPlan } from "@recipai/db";
import { dateRangeInclusive } from "@recipai/meal-planning";

import { openAppDatabase } from "@/lib/server-db";

const schema = z.object({
  startDate: z.string(),
  endDate: z.string()
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
    const list = generateShoppingListFromMealPlan(
      db,
      parsed.data.startDate,
      parsed.data.endDate,
    );

    return NextResponse.json({ list });
  } finally {
    db.close();
  }
}
