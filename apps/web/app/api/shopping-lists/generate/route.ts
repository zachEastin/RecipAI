import { NextResponse } from "next/server";
import { z } from "zod";

import {
  addMissingShoppingListItemsFromMealPlanDates,
  buildShoppingListItemsFromMealPlanDates,
  generateShoppingListFromMealPlan,
  generateShoppingListFromMealPlanDates,
  getLatestShoppingList,
  getShoppingListCoverage,
  replaceLatestShoppingListFromMealPlanDates
} from "@recipai/db";
import { dateRangeInclusive } from "@recipai/meal-planning";

import { openAppDatabase } from "@/lib/server-db";

const rangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  mode: z.undefined().optional()
});

const selectedDatesSchema = z.object({
  dates: z.array(z.string()).min(1),
  mode: z.enum(["preview", "create", "override", "add-missing"]).optional()
});

const schema = z.union([rangeSchema, selectedDatesSchema]);

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    if ("dates" in parsed.data) {
      const dates = Array.from(new Set(parsed.data.dates)).sort((a, b) => a.localeCompare(b));
      const validDates = dates.filter((date) => dateRangeInclusive(date, date).length === 1);

      if (validDates.length !== dates.length) {
        return NextResponse.json({ error: "Choose valid selected dates." }, { status: 400 });
      }

      const mode = parsed.data.mode ?? "create";
      const activeList = getLatestShoppingList(db);

      if (mode === "preview") {
        const generatedItems = buildShoppingListItemsFromMealPlanDates(db, dates);
        const coverage = activeList
          ? getShoppingListCoverage(activeList, generatedItems)
          : {
              totalItems: generatedItems.length,
              representedItems: 0,
              missingItems: generatedItems
            };

        return NextResponse.json({ activeList, coverage });
      }

      if (mode === "override") {
        const list = replaceLatestShoppingListFromMealPlanDates(db, dates);
        return NextResponse.json({ list });
      }

      if (mode === "add-missing") {
        const { list, coverage } = addMissingShoppingListItemsFromMealPlanDates(db, dates);
        return NextResponse.json({ list, coverage });
      }

      const list = generateShoppingListFromMealPlanDates(db, dates);
      return NextResponse.json({ list });
    }

    const dates = dateRangeInclusive(parsed.data.startDate, parsed.data.endDate);
    if (dates.length === 0) {
      return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
    }

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
