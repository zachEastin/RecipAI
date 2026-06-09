import { NextResponse } from "next/server";

import { clearCompletedShoppingListItems, getShoppingListById } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = openAppDatabase();

  try {
    const removed = clearCompletedShoppingListItems(db, id);
    const list = getShoppingListById(db, id);

    return list
      ? NextResponse.json({ list, removed })
      : NextResponse.json({ error: "Shopping list not found." }, { status: 404 });
  } finally {
    db.close();
  }
}
