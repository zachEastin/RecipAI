import { NextResponse } from "next/server";

import { getShoppingListById } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = openAppDatabase();

  try {
    const list = getShoppingListById(db, id);

    return list
      ? NextResponse.json({ list })
      : NextResponse.json({ error: "Shopping list not found." }, { status: 404 });
  } finally {
    db.close();
  }
}
