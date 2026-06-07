import { describe, expect, it } from "vitest";

import { aiStructuredResultSchema } from "./contracts";

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
});
