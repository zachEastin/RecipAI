import { NextResponse } from "next/server";
import { z } from "zod";

import { addShoppingListItem } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

const schema = z.object({
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  name: z.string().min(1),
  groceryCategory: z.string().min(1).default("Other")
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Item name is required." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    const item = addShoppingListItem(db, id, parsed.data);

    return item
      ? NextResponse.json({ item })
      : NextResponse.json({ error: "Shopping list not found." }, { status: 404 });
  } finally {
    db.close();
  }
}
