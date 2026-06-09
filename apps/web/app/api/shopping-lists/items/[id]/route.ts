import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteShoppingListItem, updateShoppingListItem } from "@recipai/db";
import type { ShoppingListItemUpdate } from "@recipai/db";

import { openAppDatabase } from "@/lib/server-db";

const schema = z.object({
  checked: z.boolean().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  groceryCategory: z.string().min(1).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Valid item values are required." }, { status: 400 });
  }

  const db = openAppDatabase();

  try {
    const update: ShoppingListItemUpdate = {};

    if (parsed.data.checked !== undefined) {
      update.checked = parsed.data.checked;
    }

    if (parsed.data.quantity !== undefined) {
      update.quantity = parsed.data.quantity;
    }

    if (parsed.data.unit !== undefined) {
      update.unit = parsed.data.unit;
    }

    if (parsed.data.name !== undefined) {
      update.name = parsed.data.name;
    }

    if (parsed.data.groceryCategory !== undefined) {
      update.groceryCategory = parsed.data.groceryCategory;
    }

    const item = updateShoppingListItem(db, id, update);

    return item
      ? NextResponse.json({ item })
      : NextResponse.json({ error: "Shopping list item not found." }, { status: 404 });
  } finally {
    db.close();
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = openAppDatabase();

  try {
    return deleteShoppingListItem(db, id)
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Shopping list item not found." }, { status: 404 });
  } finally {
    db.close();
  }
}
