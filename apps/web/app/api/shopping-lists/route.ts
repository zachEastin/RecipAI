import { NextResponse } from "next/server";

import { getLatestShoppingList, listShoppingLists } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

export async function GET() {
  const db = openAppDatabase();

  try {
    return NextResponse.json({
      latest: getLatestShoppingList(db),
      lists: listShoppingLists(db)
    });
  } finally {
    db.close();
  }
}
