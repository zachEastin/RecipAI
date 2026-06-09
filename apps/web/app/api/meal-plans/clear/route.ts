import { NextResponse } from "next/server";
import { z } from "zod";

import { clearMealPlanRange, clearMealPlanSlot } from "@recipai/db";
import { dateRangeInclusive } from "@recipai/meal-planning";

import { openAppDatabase } from "@/lib/server-db";

const schema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  date: z.string().optional(),
  mealSlot: z.enum(["breakfast", "lunch", "dinner"]).optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  }

  const isSlotClear = parsed.data.date && parsed.data.mealSlot;
  const isRangeClear =
    parsed.data.startDate &&
    parsed.data.endDate &&
    dateRangeInclusive(parsed.data.startDate, parsed.data.endDate).length > 0;

  if (!isSlotClear && !isRangeClear) {
    return NextResponse.json({ error: "Choose a valid date range or meal slot." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    if (isSlotClear) {
      clearMealPlanSlot(db, parsed.data.date!, parsed.data.mealSlot!);
    } else {
      clearMealPlanRange(db, parsed.data.startDate!, parsed.data.endDate!);
    }

    return NextResponse.json({ ok: true });
  } finally {
    db.close();
  }
}
