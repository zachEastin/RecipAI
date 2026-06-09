"use client";

import {
  Check,
  ClipboardList,
  Plus,
  Printer,
  RefreshCw,
  Save,
  ShoppingBasket,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState } from "react";

import type { ShoppingList, ShoppingListItem } from "@recipai/db";

import { Button } from "../ui";

type ShopResponse = {
  list?: ShoppingList;
  item?: ShoppingListItem;
  error?: string;
};

type DraftItem = {
  quantity: string;
  unit: string;
  name: string;
  groceryCategory: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function formatQuantity(value: number | null): string {
  if (value === null) {
    return "";
  }

  return Number.isInteger(value) ? String(value) : String(value);
}

function itemToDraft(item: ShoppingListItem): DraftItem {
  return {
    quantity: formatQuantity(item.quantity),
    unit: item.unit ?? "",
    name: item.name,
    groceryCategory: item.groceryCategory
  };
}

function parseQuantity(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function groupItems(items: ShoppingListItem[]): Array<[string, ShoppingListItem[]]> {
  const groups = new Map<string, ShoppingListItem[]>();

  for (const item of items) {
    const category = item.groceryCategory || "Other";
    groups.set(category, [...(groups.get(category) ?? []), item]);
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "Other") {
      return 1;
    }

    if (b === "Other") {
      return -1;
    }

    return a.localeCompare(b);
  });
}

export function ShopClient({
  startDate,
  endDate,
  initialList
}: {
  startDate: string;
  endDate: string;
  initialList: ShoppingList | null;
}) {
  const [range, setRange] = useState({ startDate, endDate });
  const [list, setList] = useState(initialList);
  const [drafts, setDrafts] = useState<Record<string, DraftItem>>(() =>
    Object.fromEntries((initialList?.items ?? []).map((item) => [item.id, itemToDraft(item)])),
  );
  const [newItem, setNewItem] = useState<DraftItem>({
    quantity: "",
    unit: "",
    name: "",
    groceryCategory: "Other"
  });
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const groupedItems = useMemo(() => groupItems(list?.items ?? []), [list]);
  const checkedCount = list?.items.filter((item) => item.checked).length ?? 0;
  const totalCount = list?.items.length ?? 0;

  function replaceList(next: ShoppingList) {
    setList(next);
    setDrafts(Object.fromEntries(next.items.map((item) => [item.id, itemToDraft(item)])));
  }

  async function generate() {
    setIsBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/shopping-lists/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(range)
      });
      const payload = (await response.json()) as ShopResponse;

      if (!response.ok || !payload.list) {
        throw new Error(payload.error ?? "Could not generate a shopping list.");
      }

      replaceList(payload.list);
      setStatus(
        payload.list.items.length > 0
          ? "Generated and saved a shopping list from planned dinners."
          : "Saved an empty list. Add planned dinners in Plan, then generate again.",
      );
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not generate a shopping list.");
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleChecked(item: ShoppingListItem, checked: boolean) {
    const draft = drafts[item.id] ?? itemToDraft(item);
    await updateItem(item.id, { ...draft, checked });
  }

  async function updateItem(
    id: string,
    draft: DraftItem & { checked?: boolean },
  ) {
    const payload = {
      quantity: parseQuantity(draft.quantity),
      unit: draft.unit.trim() || null,
      name: draft.name.trim(),
      groceryCategory: draft.groceryCategory.trim() || "Other",
      checked: draft.checked
    };

    if (!payload.name) {
      setStatus("Item name is required.");
      return;
    }

    const response = await fetch(`/api/shopping-lists/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json()) as ShopResponse;

    if (!response.ok || !result.item || !list) {
      setStatus(result.error ?? "Could not update item.");
      return;
    }

    const updatedList = {
      ...list,
      items: list.items.map((item) => (item.id === id ? result.item! : item))
    };
    replaceList(updatedList);
    setStatus("Shopping item updated.");
  }

  async function addItem() {
    if (!list) {
      setStatus("Generate a shopping list before adding items.");
      return;
    }

    if (!newItem.name.trim()) {
      setStatus("Item name is required.");
      return;
    }

    const response = await fetch(`/api/shopping-lists/${list.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: parseQuantity(newItem.quantity),
        unit: newItem.unit.trim() || null,
        name: newItem.name.trim(),
        groceryCategory: newItem.groceryCategory.trim() || "Other"
      })
    });
    const result = (await response.json()) as ShopResponse;

    if (!response.ok || !result.item) {
      setStatus(result.error ?? "Could not add item.");
      return;
    }

    const nextList = { ...list, items: [...list.items, result.item] };
    replaceList(nextList);
    setNewItem({ quantity: "", unit: "", name: "", groceryCategory: "Other" });
    setStatus("Item added.");
  }

  async function deleteItem(id: string) {
    const response = await fetch(`/api/shopping-lists/items/${id}`, { method: "DELETE" });
    const result = (await response.json()) as { error?: string };

    if (!response.ok || !list) {
      setStatus(result.error ?? "Could not delete item.");
      return;
    }

    const nextList = { ...list, items: list.items.filter((item) => item.id !== id) };
    replaceList(nextList);
    setStatus("Item deleted.");
  }

  async function clearCompleted() {
    if (!list) {
      return;
    }

    const response = await fetch(`/api/shopping-lists/${list.id}/clear-completed`, {
      method: "POST"
    });
    const result = (await response.json()) as ShopResponse;

    if (!response.ok || !result.list) {
      setStatus(result.error ?? "Could not clear completed items.");
      return;
    }

    replaceList(result.list);
    setStatus("Completed items cleared.");
  }

  return (
    <div className="screen-stack shop-screen">
      <section className="panel shop-control-panel">
        <div className="icon-title">
          <ShoppingBasket aria-hidden="true" size={24} />
          <div>
            <h2>Shopping list</h2>
            <p>Generate a grouped grocery list from planned dinners.</p>
          </div>
        </div>
        <div className="date-range-grid">
          <label>
            Start
            <input
              onChange={(event) =>
                setRange((current) => ({ ...current, startDate: event.target.value }))
              }
              type="date"
              value={range.startDate}
            />
          </label>
          <label>
            End
            <input
              onChange={(event) =>
                setRange((current) => ({ ...current, endDate: event.target.value }))
              }
              type="date"
              value={range.endDate}
            />
          </label>
        </div>
        <div className="shop-action-grid">
          <Button disabled={isBusy} onClick={generate} type="button">
            <RefreshCw aria-hidden="true" size={18} />
            {isBusy ? "Generating" : "Generate"}
          </Button>
          <Button
            disabled={!list}
            onClick={() => window.print()}
            type="button"
            variant="secondary"
          >
            <Printer aria-hidden="true" size={18} />
            Print
          </Button>
        </div>
        {status ? <p className="status-text">{status}</p> : null}
      </section>

      {list ? (
        <>
          <section className="shopping-summary">
            <div>
              <p className="plan-date">
                {formatDate(list.startsOn)} - {formatDate(list.endsOn)}
              </p>
              <h2>{list.title}</h2>
              <p>
                {checkedCount} of {totalCount} checked
              </p>
            </div>
            <Button
              disabled={checkedCount === 0}
              onClick={clearCompleted}
              type="button"
              variant="ghost"
            >
              <Check aria-hidden="true" size={17} />
              Clear
            </Button>
          </section>

          <section className="add-shopping-item">
            <div className="shop-item-grid">
              <input
                aria-label="New item quantity"
                inputMode="decimal"
                onChange={(event) =>
                  setNewItem((current) => ({ ...current, quantity: event.target.value }))
                }
                placeholder="Qty"
                value={newItem.quantity}
              />
              <input
                aria-label="New item unit"
                onChange={(event) =>
                  setNewItem((current) => ({ ...current, unit: event.target.value }))
                }
                placeholder="Unit"
                value={newItem.unit}
              />
              <input
                aria-label="New item name"
                onChange={(event) =>
                  setNewItem((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Add item"
                value={newItem.name}
              />
              <input
                aria-label="New item grocery category"
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    groceryCategory: event.target.value
                  }))
                }
                placeholder="Category"
                value={newItem.groceryCategory}
              />
            </div>
            <Button onClick={addItem} type="button" variant="secondary">
              <Plus aria-hidden="true" size={18} />
              Add item
            </Button>
          </section>

          <div className="shopping-groups">
            {groupedItems.length > 0 ? (
              groupedItems.map(([category, items]) => (
                <section className="shopping-group" key={category}>
                  <div className="shopping-group-header">
                    <h3>{category}</h3>
                    <span>{items.length}</span>
                  </div>
                  <div className="shopping-item-list">
                    {items.map((item) => {
                      const draft = drafts[item.id] ?? itemToDraft(item);

                      return (
                        <article
                          className={
                            item.checked ? "shopping-item shopping-item-checked" : "shopping-item"
                          }
                          key={item.id}
                        >
                          <label className="shopping-check">
                            <input
                              checked={item.checked}
                              onChange={(event) => toggleChecked(item, event.target.checked)}
                              type="checkbox"
                            />
                            <span>{item.checked ? <Check aria-hidden="true" size={15} /> : null}</span>
                          </label>
                          <div className="shop-item-grid">
                            <input
                              aria-label={`${item.name} quantity`}
                              inputMode="decimal"
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [item.id]: { ...draft, quantity: event.target.value }
                                }))
                              }
                              placeholder="Qty"
                              value={draft.quantity}
                            />
                            <input
                              aria-label={`${item.name} unit`}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [item.id]: { ...draft, unit: event.target.value }
                                }))
                              }
                              placeholder="Unit"
                              value={draft.unit}
                            />
                            <input
                              aria-label={`${item.name} name`}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [item.id]: { ...draft, name: event.target.value }
                                }))
                              }
                              placeholder="Item"
                              value={draft.name}
                            />
                            <input
                              aria-label={`${item.name} category`}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...draft,
                                    groceryCategory: event.target.value
                                  }
                                }))
                              }
                              placeholder="Category"
                              value={draft.groceryCategory}
                            />
                          </div>
                          <div className="shopping-item-actions">
                            <button
                              aria-label={`Save ${item.name}`}
                              className="icon-toggle"
                              onClick={() => updateItem(item.id, draft)}
                              type="button"
                            >
                              <Save aria-hidden="true" size={17} />
                            </button>
                            <button
                              aria-label={`Delete ${item.name}`}
                              className="icon-toggle icon-toggle-active"
                              onClick={() => deleteItem(item.id)}
                              type="button"
                            >
                              <Trash2 aria-hidden="true" size={17} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className="empty-state">
                <ClipboardList aria-hidden="true" size={28} />
                <h2>No items in this list</h2>
                <p>Add planned dinners, generate again, or add items manually.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <X aria-hidden="true" size={28} />
          <h2>No shopping list yet</h2>
          <p>Generate from the next 14 days of planned dinners, then edit the list as needed.</p>
        </div>
      )}
    </div>
  );
}
