import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migrate, openDatabase, saveRecipe } from "@recipai/db";

import { POST } from "./route";

let tempDir: string;

function request(body: unknown): Request {
  return new Request("http://127.0.0.1:3000/api/meal-plans/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "recipai-meal-plan-route-"));
  process.env.DATABASE_URL = `file:${join(tempDir, "recipai.sqlite")}`;
  process.env.RECIPAI_WORKSPACE_ROOT = "/";

  const db = openDatabase();
  migrate(db);
  saveRecipe(db, {
    title: "Breakfast Toast",
    summary: "A quick breakfast.",
    servings: 1,
    prepMinutes: 5,
    cookMinutes: 5,
    mealSlots: ["breakfast"],
    tags: ["breakfast"],
    provenance: "manual",
    ingredients: [{ quantity: 1, unit: null, name: "toast", note: null }],
    steps: [{ body: "Toast bread.", timerMinutes: null }]
  });
  db.close();
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.RECIPAI_WORKSPACE_ROOT;
  rmSync(tempDir, { force: true, recursive: true });
});

describe("meal plan generation API route", () => {
  it("accepts explicit non-contiguous selected dates", async () => {
    const response = await POST(
      request({
        dates: ["2026-06-08", "2026-06-10"],
        mealSlots: ["breakfast"],
        avoidRepeats: false
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.assignments.map((assignment: { date: string }) => assignment.date)).toEqual([
      "2026-06-08",
      "2026-06-10"
    ]);
  });
});
