import { describe, expect, it } from "vitest";

import { dateRangeInclusive, defaultDinnerPlanRange, generateDinnerPlan } from "./index";

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
  });

  it("preserves locked assignments during reroll", () => {
    const plan = generateDinnerPlan({
      dates: ["2026-06-08", "2026-06-09"],
      recipes,
      existingAssignments: [
        { date: "2026-06-08", recipeId: "b", locked: true },
        { date: "2026-06-09", recipeId: "c", locked: false }
      ],
      rerollDates: ["2026-06-08", "2026-06-09"],
      random: () => 0
    });

    expect(plan[0]).toEqual({ date: "2026-06-08", recipeId: "b", locked: true });
    expect(plan[1]?.recipeId).not.toBe("b");
  });
});
