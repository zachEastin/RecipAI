import { describe, expect, it } from "vitest";

import { aiStructuredResultSchema } from "./contracts";
import { buildUserPrompt } from "./prompts";
import { parseStructuredAiText } from "./client";

describe("aiStructuredResultSchema", () => {
  it("accepts a structured recipe result instead of chatbot text", () => {
    const result = aiStructuredResultSchema.parse({
      type: "recipe-result",
      title: "Fast Garlic Noodles",
      summary: "A quick pantry dinner.",
      servings: 4,
      totalMinutes: 20,
      difficulty: "easy",
      tags: ["fast"],
      ingredients: [{ quantity: 8, unit: "oz", name: "noodles", note: null }],
      steps: [{ body: "Boil noodles.", timerMinutes: 8 }],
      tips: ["Save pasta water."],
      substitutions: ["Use spaghetti if needed."]
    });

    expect(result.type).toBe("recipe-result");
  });

  it("extracts structured JSON from fenced provider text", () => {
    const result = parseStructuredAiText(`\`\`\`json
{
  "type": "recipe-result",
  "title": "Skillet Rice",
  "summary": "A practical dinner.",
  "servings": 4,
  "totalMinutes": 25,
  "difficulty": "easy",
  "tags": ["fast"],
  "ingredients": [{"quantity": 1, "unit": "cup", "name": "rice", "note": null}],
  "steps": [{"body": "Cook the rice.", "timerMinutes": 18}],
  "tips": [],
  "substitutions": []
}
\`\`\``);

    expect(result.title).toBe("Skillet Rice");
  });

  it("includes saved recipe context for modification prompts", () => {
    const prompt = buildUserPrompt({
      provider: "deepseek",
      mode: "modify-saved-recipe",
      prompt: "Make it faster.",
      sourceRecipeId: "abc",
      sourceRecipe: {
        title: "Chicken Bowls",
        summary: "A saved dinner.",
        servings: 4,
        prepMinutes: 15,
        cookMinutes: 25,
        tags: ["chicken"],
        ingredients: [{ quantity: 1, unit: "lb", name: "chicken", note: null }],
        steps: [{ body: "Cook chicken.", timerMinutes: 12 }]
      }
    });

    expect(prompt).toContain("Make it faster.");
    expect(prompt).toContain("Chicken Bowls");
  });
});
