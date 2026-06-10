import { NextResponse } from "next/server";

import { listRecipes, saveRecipe, searchRecipes } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";
import { recipeInputSchema, toSaveRecipeInput } from "./input";

export async function GET(request: Request) {
  const db = openAppDatabase();

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const recipes = query ? searchRecipes(db, query) : listRecipes(db);
    return NextResponse.json({ recipes });
  } finally {
    db.close();
  }
}

export async function POST(request: Request) {
  const parsed = recipeInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Recipe needs a title, ingredients, and steps." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    const recipe = saveRecipe(db, toSaveRecipeInput(parsed.data));
    return NextResponse.json({ recipe });
  } finally {
    db.close();
  }
}
