import { NextResponse } from "next/server";

import { markRecipeCooked } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = openAppDatabase();

  try {
    const recipe = markRecipeCooked(db, id, new Date().toISOString());

    return recipe
      ? NextResponse.json({ recipe })
      : NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  } finally {
    db.close();
  }
}
