import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeResult } from "@recipai/ai";
import { migrate, openDatabase, saveRecipe } from "@recipai/db";

import { POST } from "./route";

const validRecipeResult: RecipeResult = {
  type: "recipe-result",
  title: "Mocked Rice Dinner",
  summary: "A mocked provider recipe.",
  servings: 4,
  totalMinutes: 25,
  difficulty: "easy",
  tags: ["test"],
  ingredients: [{ quantity: 1, unit: "cup", name: "rice", note: null }],
  steps: [{ body: "Cook rice.", timerMinutes: 18 }],
  tips: [],
  substitutions: []
};

let tempDir: string;

function request(body: unknown): Request {
  return new Request("http://127.0.0.1:3000/api/ai/recipe-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function mockProvider(content: string, ok = true): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ok
        ? Response.json({ choices: [{ message: { content } }] })
        : new Response("provider failed", { status: 500 }),
    ),
  );
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "recipai-ai-route-"));
  process.env.DATABASE_URL = `file:${join(tempDir, "recipai.sqlite")}`;
  process.env.RECIPAI_WORKSPACE_ROOT = "/";
  process.env.AI_PROVIDER = "deepseek";
  process.env.DEEPSEEK_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DATABASE_URL;
  delete process.env.AI_PROVIDER;
  delete process.env.DEEPSEEK_API_KEY;
  rmSync(tempDir, { force: true, recursive: true });
});

describe("recipe prompt API route", () => {
  it("returns and persists a structured provider result", async () => {
    mockProvider(JSON.stringify(validRecipeResult));

    const response = await POST(
      request({
        mode: "general-recipe",
        prompt: "Make a quick rice dinner."
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.result.title).toBe("Mocked Rice Dinner");
    expect(payload.run.saveStatus).toBe("unsaved");
  });

  it("returns 400 before calling the provider for invalid request shape", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(
      request({
        mode: "general-recipe",
        prompt: "no"
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("detail");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 502 when the provider request fails", async () => {
    mockProvider("", false);

    const response = await POST(
      request({
        mode: "general-recipe",
        prompt: "Make dinner."
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain("could not complete");
  });

  it("returns 502 when provider JSON does not match the contract", async () => {
    mockProvider(JSON.stringify({ type: "recipe-result", title: "Incomplete" }));

    const response = await POST(
      request({
        mode: "general-recipe",
        prompt: "Make dinner."
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain("could not be formatted");
  });

  it("returns 500 when the configured provider key is missing", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(
      request({
        mode: "general-recipe",
        prompt: "Make dinner."
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toContain("not configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("includes saved recipe context for modification requests", async () => {
    const db = openDatabase();
    migrate(db);
    const recipe = saveRecipe(db, {
      title: "Saved Rice Bowls",
      summary: "A saved dinner.",
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 20,
      tags: ["rice"],
      provenance: "manual",
      ingredients: [{ quantity: 1, unit: "cup", name: "rice", note: null }],
      steps: [{ body: "Cook rice.", timerMinutes: 18 }]
    });
    db.close();
    mockProvider(JSON.stringify({
      type: "recipe-modification-result",
      title: "Faster Saved Rice Bowls",
      changeSummary: ["Uses leftover rice."],
      servingImpact: "Same servings.",
      timeImpact: "Faster.",
      updatedRecipe: validRecipeResult
    }));

    const response = await POST(
      request({
        mode: "modify-saved-recipe",
        prompt: "Make it faster.",
        sourceRecipeId: recipe.id
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.run.sourceRecipeId).toBe(recipe.id);
    expect(payload.result.type).toBe("recipe-modification-result");
  });
});
