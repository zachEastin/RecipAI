import { NextResponse } from "next/server";

import { getLatestShoppingList, listRecipes } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

export async function GET() {
  const db = openAppDatabase();

  try {
    const mealPlans = db.prepare("SELECT * FROM meal_plans ORDER BY plan_date ASC").all();
    const shoppingLists = db
      .prepare("SELECT id, title, starts_on, ends_on, created_at FROM shopping_lists ORDER BY created_at DESC")
      .all();
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      recipes: listRecipes(db),
      mealPlans,
      shoppingLists,
      latestShoppingList: getLatestShoppingList(db)
    };

    return NextResponse.json(exportPayload, {
      headers: {
        "Content-Disposition": `attachment; filename=\"recipai-export-${Date.now()}.json\"`
      }
    });
  } finally {
    db.close();
  }
}
