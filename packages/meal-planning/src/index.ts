export type PlanRecipeCandidate = {
  id: string;
  title: string;
};

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

export type PlanTarget = {
  date: string;
  mealSlot: MealSlot;
};

export type PlanAssignment = {
  date: string;
  mealSlot: MealSlot;
  recipeId: string;
  locked: boolean;
};

export type GenerateMealPlanInput = {
  dates: string[];
  mealSlots: MealSlot[];
  recipes: PlanRecipeCandidate[];
  existingAssignments?: PlanAssignment[];
  rerollTargets?: PlanTarget[];
  preserveLocked?: boolean;
  fillEmptyOnly?: boolean;
  avoidRepeats?: boolean;
  random?: () => number;
};

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function toLocalIsoDate(date: Date): string {
  return isoDateFormatter.format(date);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function defaultDinnerPlanRange(today = new Date()): { startDate: string; endDate: string } {
  return {
    startDate: toLocalIsoDate(today),
    endDate: toLocalIsoDate(addDays(today, 13))
  };
}

export function dateRangeInclusive(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(toLocalIsoDate(cursor));
  }

  return dates;
}

function pickRandom<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0]!;
}

function targetKey(target: PlanTarget): string {
  return `${target.date}::${target.mealSlot}`;
}

export function generateMealPlan(input: GenerateMealPlanInput): PlanAssignment[] {
  const random = input.random ?? Math.random;
  const recipes = input.recipes;
  const mealSlots = input.mealSlots.filter((slot) =>
    (MEAL_SLOTS as readonly string[]).includes(slot),
  );

  if (recipes.length === 0 || mealSlots.length === 0) {
    return [];
  }

  const targets = input.dates.flatMap((date) =>
    mealSlots.map((mealSlot) => ({ date, mealSlot })),
  );
  const targetKeys = new Set(targets.map(targetKey));
  const rerollTargets = new Set((input.rerollTargets ?? targets).map(targetKey));
  const preserveLocked = input.preserveLocked ?? true;
  const fillEmptyOnly = input.fillEmptyOnly ?? false;
  const avoidRepeats = input.avoidRepeats ?? true;
  const existingByDate = new Map(
    (input.existingAssignments ?? []).map((assignment) => [targetKey(assignment), assignment]),
  );
  const preserved = (input.existingAssignments ?? [])
    .filter((assignment): assignment is PlanAssignment => {
      const key = targetKey(assignment);
      return !targetKeys.has(key) || (preserveLocked && assignment.locked) || !rerollTargets.has(key);
    });
  const usedRecipeIds = new Set(preserved.map((assignment) => assignment.recipeId));
  const assignments: PlanAssignment[] = [];

  for (const target of targets) {
    const key = targetKey(target);
    const existing = existingByDate.get(key);
    if (
      existing &&
      ((preserveLocked && existing.locked) || !rerollTargets.has(key) || fillEmptyOnly)
    ) {
      assignments.push(existing);
      continue;
    }

    const unusedRecipes = recipes.filter((recipe) => !usedRecipeIds.has(recipe.id));
    const pool = avoidRepeats && unusedRecipes.length > 0 ? unusedRecipes : recipes;
    const recipe = pickRandom(pool, random);
    usedRecipeIds.add(recipe.id);
    assignments.push({ ...target, recipeId: recipe.id, locked: false });
  }

  return [...preserved.filter((assignment) => !targetKeys.has(targetKey(assignment))), ...assignments]
    .filter((assignment, index, all) => {
      const key = targetKey(assignment);
      return all.findIndex((item) => targetKey(item) === key) === index;
    })
    .sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }

      return MEAL_SLOTS.indexOf(a.mealSlot) - MEAL_SLOTS.indexOf(b.mealSlot);
    });
}

export type GenerateDinnerPlanInput = Omit<GenerateMealPlanInput, "mealSlots" | "rerollTargets"> & {
  rerollDates?: string[];
};

export function generateDinnerPlan(input: GenerateDinnerPlanInput): PlanAssignment[] {
  const mealPlanInput: GenerateMealPlanInput = {
    ...input,
    mealSlots: ["dinner"]
  };

  if (input.rerollDates) {
    mealPlanInput.rerollTargets = input.rerollDates.map((date) => ({ date, mealSlot: "dinner" }));
  }

  return generateMealPlan(mealPlanInput);
}
