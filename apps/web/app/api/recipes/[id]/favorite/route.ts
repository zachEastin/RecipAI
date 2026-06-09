import { NextResponse } from "next/server";
import { z } from "zod";

import { updateRecipeFavorite } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

const schema = z.object({ favorite: z.boolean() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Favorite value is required." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    const recipe = updateRecipeFavorite(db, id, parsed.data.favorite);
    return recipe
      ? NextResponse.json({ recipe })
      : NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  } finally {
    db.close();
  }
}
