import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "./route";
import { PUT } from "./[id]/route";

let tempDir: string;

function request(body: unknown): Request {
  return new Request("http://127.0.0.1:3000/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const recipePayload = {
  title: "Breakfast Rice Bowl",
  summary: "Eggs and rice for a fast morning meal.",
  source: null,
  servings: 2,
  prepMinutes: 5,
  cookMinutes: 10,
  mealSlots: ["breakfast", "lunch"],
  rating: 0,
  tags: ["breakfast", "rice"],
  favorite: false,
  provenance: "manual",
  ingredients: [{ quantity: 2, unit: null, name: "eggs", note: null }],
  steps: [{ body: "Cook eggs and serve over rice.", timerMinutes: null }]
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "recipai-recipes-route-"));
  process.env.DATABASE_URL = `file:${join(tempDir, "recipai.sqlite")}`;
  process.env.RECIPAI_WORKSPACE_ROOT = "/";
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.RECIPAI_WORKSPACE_ROOT;
  rmSync(tempDir, { force: true, recursive: true });
});

describe("recipes API route", () => {
  it("creates recipes with explicit meal slots", async () => {
    const response = await POST(request(recipePayload));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.recipe.mealSlots).toEqual(["breakfast", "lunch"]);
  });

  it("updates recipes with validated meal slots", async () => {
    const createResponse = await POST(request(recipePayload));
    const created = await createResponse.json();

    const updateResponse = await PUT(
      request({
        ...recipePayload,
        title: "Dinner Rice Bowl",
        mealSlots: ["dinner"]
      }),
      { params: Promise.resolve({ id: created.recipe.id }) },
    );
    const updated = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updated.recipe.title).toBe("Dinner Rice Bowl");
    expect(updated.recipe.mealSlots).toEqual(["dinner"]);
  });
});
