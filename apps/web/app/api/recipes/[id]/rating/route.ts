import { NextResponse } from "next/server";
import { z } from "zod";

import { updateRecipeRating } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

const schema = z.object({ rating: z.number().int().min(0).max(5) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Rating must be 0 through 5." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    const recipe = updateRecipeRating(db, id, parsed.data.rating);
    return recipe
      ? NextResponse.json({ recipe })
      : NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  } finally {
    db.close();
  }
}
