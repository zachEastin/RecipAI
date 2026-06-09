import { NextResponse } from "next/server";

import { getRecipeById, saveRecipe } from "@recipai/db";
import type { SaveRecipeInput } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = openAppDatabase();

  try {
    const recipe = getRecipeById(db, id);

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
    }

    return NextResponse.json({ recipe });
  } finally {
    db.close();
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = (await request.json()) as SaveRecipeInput;
  const db = openAppDatabase();

  try {
    const existing = getRecipeById(db, id);

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
    }

    const recipe = saveRecipe(db, { ...payload, id });
    return NextResponse.json({ recipe });
  } finally {
    db.close();
  }
}
