import { describe, expect, it } from "vitest";

import { dateRangeInclusive, defaultDinnerPlanRange, generateDinnerPlan, generateMealPlan } from "./index";

const recipes = [
  { id: "a", title: "A", mealSlots: ["lunch" as const, "dinner" as const] },
  { id: "b", title: "B", mealSlots: ["dinner" as const] },
  { id: "c", title: "C", mealSlots: ["dinner" as const] }
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
      recipes: [
        { id: "breakfast", title: "Breakfast", mealSlots: ["breakfast"] },
        { id: "lunch", title: "Lunch", mealSlots: ["lunch"] },
        { id: "dinner", title: "Dinner", mealSlots: ["dinner"] }
      ],
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

  it("only assigns recipes marked for the target meal slot", () => {
    const plan = generateMealPlan({
      dates: ["2026-06-08"],
      mealSlots: ["breakfast", "dinner"],
      recipes: [
        { id: "eggs", title: "Eggs", mealSlots: ["breakfast"] },
        { id: "pasta", title: "Pasta", mealSlots: ["dinner"] }
      ],
      random: () => 0
    });

    expect(plan).toEqual([
      { date: "2026-06-08", mealSlot: "breakfast", recipeId: "eggs", locked: false },
      { date: "2026-06-08", mealSlot: "dinner", recipeId: "pasta", locked: false }
    ]);
  });

  it("skips slots with no eligible candidates", () => {
    const plan = generateMealPlan({
      dates: ["2026-06-08"],
      mealSlots: ["breakfast"],
      recipes,
      random: () => 0
    });

    expect(plan).toEqual([]);
  });

  it("preserves locked assignments even when recipe eligibility changed", () => {
    const plan = generateMealPlan({
      dates: ["2026-06-08"],
      mealSlots: ["breakfast"],
      recipes,
      existingAssignments: [
        { date: "2026-06-08", mealSlot: "breakfast", recipeId: "a", locked: true }
      ],
      rerollTargets: [{ date: "2026-06-08", mealSlot: "breakfast" }],
      random: () => 0
    });

    expect(plan).toEqual([
      { date: "2026-06-08", mealSlot: "breakfast", recipeId: "a", locked: true }
    ]);
  });

  it("prefers quick weekday meals when that option is enabled", () => {
    const plan = generateMealPlan({
      dates: ["2026-06-08"],
      mealSlots: ["lunch"],
      recipes: [
        {
          id: "project",
          title: "Project Lunch",
          mealSlots: ["lunch"],
          prepMinutes: 30,
          cookMinutes: 40,
          rating: 5
        },
        {
          id: "quick",
          title: "Quick Lunch",
          mealSlots: ["lunch"],
          prepMinutes: 5,
          cookMinutes: 8,
          rating: 3
        }
      ],
      random: () => 0
    });

    expect(plan[0]?.recipeId).toBe("quick");
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
