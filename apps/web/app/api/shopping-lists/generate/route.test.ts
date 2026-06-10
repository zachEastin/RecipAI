import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migrate, openDatabase, saveMealPlanEntries, saveRecipe } from "@recipai/db";

import { POST } from "./route";

let tempDir: string;

function request(body: unknown): Request {
  return new Request("http://127.0.0.1:3000/api/shopping-lists/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "recipai-shopping-list-route-"));
  process.env.DATABASE_URL = `file:${join(tempDir, "recipai.sqlite")}`;
  process.env.RECIPAI_WORKSPACE_ROOT = "/";

  const db = openDatabase();
  migrate(db);
  const recipe = saveRecipe(db, {
    title: "Rice Dinner",
    summary: "Simple rice.",
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 20,
    mealSlots: ["dinner"],
    tags: ["dinner"],
    provenance: "manual",
    ingredients: [{ quantity: 1, unit: "cup", name: "rice", note: null, groceryCategory: "Grains" }],
    steps: [{ body: "Cook rice.", timerMinutes: 20 }]
  });
  saveMealPlanEntries(db, [
    { date: "2026-06-08", mealSlot: "dinner", recipeId: recipe.id, locked: false }
  ]);
  db.close();
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.RECIPAI_WORKSPACE_ROOT;
  rmSync(tempDir, { force: true, recursive: true });
});

describe("shopping list generation API route", () => {
  it("creates from selected dates when no active list exists", async () => {
    const response = await POST(request({ dates: ["2026-06-08"], mode: "create" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.list.items.map((item: { name: string }) => item.name)).toEqual(["rice"]);
  });

  it("previews active-list coverage and adds only missing items", async () => {
    await POST(request({ dates: ["2026-06-08"], mode: "create" }));

    const previewResponse = await POST(request({ dates: ["2026-06-08"], mode: "preview" }));
    const preview = await previewResponse.json();

    expect(previewResponse.status).toBe(200);
    expect(preview.activeList).toBeTruthy();
    expect(preview.coverage.missingItems).toHaveLength(0);

    const addResponse = await POST(request({ dates: ["2026-06-08"], mode: "add-missing" }));
    const added = await addResponse.json();

    expect(addResponse.status).toBe(200);
    expect(added.list.items).toHaveLength(1);
  });

  it("overrides the active list", async () => {
    const createdResponse = await POST(request({ dates: ["2026-06-08"], mode: "create" }));
    const created = await createdResponse.json();

    const overrideResponse = await POST(request({ dates: ["2026-06-08"], mode: "override" }));
    const overridden = await overrideResponse.json();

    expect(overrideResponse.status).toBe(200);
    expect(overridden.list.id).toBe(created.list.id);
    expect(overridden.list.items.map((item: { name: string }) => item.name)).toEqual(["rice"]);
  });
});
