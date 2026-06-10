import type Database from "better-sqlite3";

import {
  aggregateIngredients,
  normalizeIngredientName,
  normalizeShoppingUnit,
  type AggregatedShoppingListItem
} from "@recipai/shopping-list";

import { listMealPlanEntries } from "./meal-plans";

export type ShoppingListItem = {
  id: string;
  shoppingListId: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  groceryCategory: string;
  checked: boolean;
  sortOrder: number;
};

export type ShoppingList = {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  createdAt: string;
  items: ShoppingListItem[];
};

export type SaveShoppingListInput = {
  title: string;
  startsOn: string;
  endsOn: string;
  items: AggregatedShoppingListItem[];
};

export type ShoppingListCoverage = {
  totalItems: number;
  representedItems: number;
  missingItems: AggregatedShoppingListItem[];
};

export type ShoppingListItemUpdate = Partial<
  Pick<ShoppingListItem, "checked" | "groceryCategory" | "name" | "quantity" | "unit">
>;

type ShoppingListRow = {
  id: string;
  title: string;
  starts_on: string;
  ends_on: string;
  created_at: string;
};

type ShoppingListItemRow = {
  id: string;
  shopping_list_id: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  grocery_category: string;
  checked: number;
  sort_order: number;
};

function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function itemCoverageKey(item: Pick<AggregatedShoppingListItem, "name" | "unit">): string {
  return `${normalizeIngredientName(item.name)}::${normalizeShoppingUnit(item.unit) ?? "unitless"}`;
}

function sortedUniqueDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));
}

function selectedDatesTitle(dates: string[]): string {
  if (dates.length === 1) {
    return `Shopping list: ${dates[0]}`;
  }

  return `Shopping list: ${dates[0]} to ${dates.at(-1)}`;
}

function mapShoppingListItem(row: ShoppingListItemRow): ShoppingListItem {
  return {
    id: row.id,
    shoppingListId: row.shopping_list_id,
    quantity: row.quantity,
    unit: row.unit,
    name: row.name,
    groceryCategory: row.grocery_category,
    checked: row.checked === 1,
    sortOrder: row.sort_order
  };
}

function mapShoppingList(db: Database.Database, row: ShoppingListRow): ShoppingList {
  const items = db
    .prepare(
      `SELECT id, shopping_list_id, quantity, unit, name, grocery_category, checked, sort_order
       FROM shopping_list_items
       WHERE shopping_list_id = ?
       ORDER BY grocery_category ASC, sort_order ASC`,
    )
    .all(row.id) as ShoppingListItemRow[];

  return {
    id: row.id,
    title: row.title,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    createdAt: row.created_at,
    items: items.map(mapShoppingListItem)
  };
}

export function listShoppingLists(db: Database.Database): ShoppingList[] {
  const rows = db
    .prepare(
      `SELECT id, title, starts_on, ends_on, created_at
       FROM shopping_lists
       ORDER BY created_at DESC, starts_on DESC`,
    )
    .all() as ShoppingListRow[];

  return rows.map((row) => mapShoppingList(db, row));
}

export function getShoppingListById(
  db: Database.Database,
  id: string,
): ShoppingList | null {
  const row = db
    .prepare("SELECT id, title, starts_on, ends_on, created_at FROM shopping_lists WHERE id = ?")
    .get(id) as ShoppingListRow | undefined;

  return row ? mapShoppingList(db, row) : null;
}

export function getLatestShoppingList(db: Database.Database): ShoppingList | null {
  const row = db
    .prepare(
      `SELECT id, title, starts_on, ends_on, created_at
       FROM shopping_lists
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get() as ShoppingListRow | undefined;

  return row ? mapShoppingList(db, row) : null;
}

export function saveShoppingList(
  db: Database.Database,
  input: SaveShoppingListInput,
): ShoppingList {
  const id = uniqueId("shopping");
  const save = db.transaction(() => {
    db.prepare(
      `INSERT INTO shopping_lists (id, title, starts_on, ends_on, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    ).run(id, input.title, input.startsOn, input.endsOn);

    const insertItem = db.prepare(
      `INSERT INTO shopping_list_items (
        id, shopping_list_id, quantity, unit, name, grocery_category, checked, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    );

    input.items.forEach((item, index) => {
      insertItem.run(
        `${id}_item_${index + 1}`,
        id,
        item.quantity,
        item.unit,
        item.name,
        item.groceryCategory || "Other",
        index + 1,
      );
    });
  });

  save();

  const list = getShoppingListById(db, id);
  if (!list) {
    throw new Error("Shopping list save failed.");
  }

  return list;
}

function replaceShoppingList(
  db: Database.Database,
  id: string,
  input: SaveShoppingListInput,
): ShoppingList {
  const replace = db.transaction(() => {
    db.prepare(
      `UPDATE shopping_lists
       SET title = ?, starts_on = ?, ends_on = ?, created_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(input.title, input.startsOn, input.endsOn, id);

    db.prepare("DELETE FROM shopping_list_items WHERE shopping_list_id = ?").run(id);

    const insertItem = db.prepare(
      `INSERT INTO shopping_list_items (
        id, shopping_list_id, quantity, unit, name, grocery_category, checked, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    );

    input.items.forEach((item, index) => {
      insertItem.run(
        `${id}_item_${Date.now()}_${index + 1}`,
        id,
        item.quantity,
        item.unit,
        item.name,
        item.groceryCategory || "Other",
        index + 1,
      );
    });
  });

  replace();

  const list = getShoppingListById(db, id);
  if (!list) {
    throw new Error("Shopping list replace failed.");
  }

  return list;
}

export function buildShoppingListItemsFromMealPlanDates(
  db: Database.Database,
  dates: string[],
): AggregatedShoppingListItem[] {
  const selectedDates = sortedUniqueDates(dates);
  if (selectedDates.length === 0) {
    return [];
  }

  const entries = listMealPlanEntries(
    db,
    selectedDates[0]!,
    selectedDates.at(-1)!,
  ).filter((entry) => selectedDates.includes(entry.date) && entry.recipe);
  const ingredients = entries.flatMap((entry) =>
    entry.recipe!.ingredients.map((ingredient) => ({
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      name: ingredient.name,
      groceryCategory: ingredient.groceryCategory
    })),
  );

  return aggregateIngredients(ingredients);
}

export function getShoppingListCoverage(
  list: ShoppingList,
  generatedItems: AggregatedShoppingListItem[],
): ShoppingListCoverage {
  const activeQuantities = new Map<string, number | null>();

  for (const item of list.items) {
    const key = itemCoverageKey(item);
    const existing = activeQuantities.get(key);

    if (item.quantity === null) {
      activeQuantities.set(key, null);
      continue;
    }

    if (existing === null) {
      continue;
    }

    activeQuantities.set(key, (existing ?? 0) + item.quantity);
  }

  const missingItems = generatedItems.filter((item) => {
    const representedQuantity = activeQuantities.get(itemCoverageKey(item));

    if (representedQuantity === undefined) {
      return true;
    }

    if (item.quantity === null || representedQuantity === null) {
      return false;
    }

    return representedQuantity < item.quantity;
  });

  return {
    totalItems: generatedItems.length,
    representedItems: generatedItems.length - missingItems.length,
    missingItems
  };
}

export function generateShoppingListFromMealPlan(
  db: Database.Database,
  startDate: string,
  endDate: string,
): ShoppingList {
  const dates = [];
  for (let cursor = new Date(`${startDate}T12:00:00`); cursor <= new Date(`${endDate}T12:00:00`); cursor.setDate(cursor.getDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  const items = buildShoppingListItemsFromMealPlanDates(db, dates);

  return saveShoppingList(db, {
    title: `Shopping list: ${startDate} to ${endDate}`,
    startsOn: startDate,
    endsOn: endDate,
    items
  });
}

export function generateShoppingListFromMealPlanDates(
  db: Database.Database,
  dates: string[],
): ShoppingList {
  const selectedDates = sortedUniqueDates(dates);
  const items = buildShoppingListItemsFromMealPlanDates(db, selectedDates);

  return saveShoppingList(db, {
    title: selectedDatesTitle(selectedDates),
    startsOn: selectedDates[0]!,
    endsOn: selectedDates.at(-1)!,
    items
  });
}

export function replaceLatestShoppingListFromMealPlanDates(
  db: Database.Database,
  dates: string[],
): ShoppingList {
  const latestList = getLatestShoppingList(db);
  if (!latestList) {
    return generateShoppingListFromMealPlanDates(db, dates);
  }

  const selectedDates = sortedUniqueDates(dates);
  const items = buildShoppingListItemsFromMealPlanDates(db, selectedDates);

  return replaceShoppingList(db, latestList.id, {
    title: selectedDatesTitle(selectedDates),
    startsOn: selectedDates[0]!,
    endsOn: selectedDates.at(-1)!,
    items
  });
}

export function addMissingShoppingListItemsFromMealPlanDates(
  db: Database.Database,
  dates: string[],
): { list: ShoppingList; coverage: ShoppingListCoverage } {
  const latestList = getLatestShoppingList(db);
  if (!latestList) {
    const list = generateShoppingListFromMealPlanDates(db, dates);
    return {
      list,
      coverage: {
        totalItems: list.items.length,
        representedItems: 0,
        missingItems: list.items.map((item) => ({
          quantity: item.quantity,
          unit: item.unit,
          name: item.name,
          groceryCategory: item.groceryCategory
        }))
      }
    };
  }

  const generatedItems = buildShoppingListItemsFromMealPlanDates(db, dates);
  const coverage = getShoppingListCoverage(latestList, generatedItems);

  const insert = db.transaction(() => {
    for (const item of coverage.missingItems) {
      addShoppingListItem(db, latestList.id, item);
    }
  });
  insert();

  const list = getShoppingListById(db, latestList.id);
  if (!list) {
    throw new Error("Shopping list update failed.");
  }

  return { list, coverage };
}

export function updateShoppingListItem(
  db: Database.Database,
  id: string,
  update: ShoppingListItemUpdate,
): ShoppingListItem | null {
  const existing = db
    .prepare(
      `SELECT id, shopping_list_id, quantity, unit, name, grocery_category, checked, sort_order
       FROM shopping_list_items
       WHERE id = ?`,
    )
    .get(id) as ShoppingListItemRow | undefined;

  if (!existing) {
    return null;
  }

  db.prepare(
    `UPDATE shopping_list_items
     SET quantity = ?, unit = ?, name = ?, grocery_category = ?, checked = ?
     WHERE id = ?`,
  ).run(
    update.quantity === undefined ? existing.quantity : update.quantity,
    update.unit === undefined ? existing.unit : update.unit,
    update.name === undefined ? existing.name : update.name.trim(),
    update.groceryCategory === undefined
      ? existing.grocery_category
      : update.groceryCategory.trim() || "Other",
    update.checked === undefined ? existing.checked : update.checked ? 1 : 0,
    id,
  );

  const next = db
    .prepare(
      `SELECT id, shopping_list_id, quantity, unit, name, grocery_category, checked, sort_order
       FROM shopping_list_items
       WHERE id = ?`,
    )
    .get(id) as ShoppingListItemRow | undefined;

  return next ? mapShoppingListItem(next) : null;
}

export function addShoppingListItem(
  db: Database.Database,
  shoppingListId: string,
  item: AggregatedShoppingListItem,
): ShoppingListItem | null {
  const listExists = db.prepare("SELECT 1 FROM shopping_lists WHERE id = ?").get(shoppingListId);

  if (!listExists) {
    return null;
  }

  const nextOrder = (
    db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM shopping_list_items WHERE shopping_list_id = ?",
      )
      .get(shoppingListId) as { sort_order: number }
  ).sort_order;
  const id = uniqueId("shopping_item");

  db.prepare(
    `INSERT INTO shopping_list_items (
      id, shopping_list_id, quantity, unit, name, grocery_category, checked, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(
    id,
    shoppingListId,
    item.quantity,
    item.unit,
    item.name.trim(),
    item.groceryCategory.trim() || "Other",
    nextOrder,
  );

  const row = db
    .prepare(
      `SELECT id, shopping_list_id, quantity, unit, name, grocery_category, checked, sort_order
       FROM shopping_list_items
       WHERE id = ?`,
    )
    .get(id) as ShoppingListItemRow | undefined;

  return row ? mapShoppingListItem(row) : null;
}

export function deleteShoppingListItem(db: Database.Database, id: string): boolean {
  return db.prepare("DELETE FROM shopping_list_items WHERE id = ?").run(id).changes > 0;
}

export function clearCompletedShoppingListItems(
  db: Database.Database,
  shoppingListId: string,
): number {
  return db
    .prepare("DELETE FROM shopping_list_items WHERE shopping_list_id = ? AND checked = 1")
    .run(shoppingListId).changes;
}
