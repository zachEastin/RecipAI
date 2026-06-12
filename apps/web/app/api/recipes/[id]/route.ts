import { NextResponse } from "next/server";

import { getRecipeById, saveRecipe } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";
import { recipeInputSchema, toSaveRecipeInput } from "../input";

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
  const parsed = recipeInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Recipe needs a title, ingredients, and steps." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    const existing = getRecipeById(db, id);

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
    }

    const recipe = saveRecipe(db, {
      ...toSaveRecipeInput(parsed.data),
      id,
      imageUrl: parsed.data.imageUrl === undefined ? existing.imageUrl : parsed.data.imageUrl
    });
    return NextResponse.json({ recipe });
  } finally {
    db.close();
  }
}
