import { describe, expect, it } from "vitest";

import { dateRangeInclusive, defaultDinnerPlanRange, generateDinnerPlan, generateMealPlan } from "./index";

const recipes = [
  { id: "a", title: "A" },
  { id: "b", title: "B" },
  { id: "c", title: "C" }
];

describe("meal planning", () => {
  it("creates the default 14-day dinner range", () => {
    const range = defaultDinnerPlanRange(new Date("2026-06-08T12:00:00"));

    expect(dateRangeInclusive(range.startDate, range.endDate)).toHaveLength(14);
  });

  it("assigns dinners without duplicates when enough recipes exist", () => {
    const plan = generateDinnerPlan({
      dates: ["2026-06-08", "2026-06-09", "2026-06-10"],
      recipes,
      random: () => 0
    });

    expect(new Set(plan.map((item) => item.recipeId)).size).toBe(3);
    expect(plan.every((item) => item.mealSlot === "dinner")).toBe(true);
  });

  it("fills selected breakfast, lunch, and dinner slots", () => {
    const plan = generateMealPlan({
      dates: ["2026-06-08", "2026-06-09"],
      mealSlots: ["breakfast", "lunch", "dinner"],
      recipes,
      random: () => 0
    });

    expect(plan).toHaveLength(6);
    expect(plan.map((item) => `${item.date}:${item.mealSlot}`)).toEqual([
      "2026-06-08:breakfast",
      "2026-06-08:lunch",
      "2026-06-08:dinner",
      "2026-06-09:breakfast",
      "2026-06-09:lunch",
      "2026-06-09:dinner"
    ]);
  });

  it("preserves locked assignments during reroll", () => {
    const plan = generateMealPlan({
      dates: ["2026-06-08", "2026-06-09"],
      mealSlots: ["dinner"],
      recipes,
      existingAssignments: [
        { date: "2026-06-08", mealSlot: "dinner", recipeId: "b", locked: true },
        { date: "2026-06-09", mealSlot: "dinner", recipeId: "c", locked: false }
      ],
      rerollTargets: [
        { date: "2026-06-08", mealSlot: "dinner" },
        { date: "2026-06-09", mealSlot: "dinner" }
      ],
      random: () => 0
    });

    expect(plan[0]).toEqual({
      date: "2026-06-08",
      mealSlot: "dinner",
      recipeId: "b",
      locked: true
    });
    expect(plan[1]?.recipeId).not.toBe("b");
  });

  it("fills only empty selected slots when requested", () => {
    const plan = generateMealPlan({
      dates: ["2026-06-08"],
      mealSlots: ["breakfast", "lunch"],
      recipes,
      existingAssignments: [
        { date: "2026-06-08", mealSlot: "breakfast", recipeId: "b", locked: false }
      ],
      fillEmptyOnly: true,
      random: () => 0
    });

    expect(plan).toEqual([
      { date: "2026-06-08", mealSlot: "breakfast", recipeId: "b", locked: false },
      { date: "2026-06-08", mealSlot: "lunch", recipeId: "a", locked: false }
    ]);
  });
});
