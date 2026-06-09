export type PlanRecipeCandidate = {
  id: string;
  title: string;
};

export type PlanAssignment = {
  date: string;
  recipeId: string;
  locked: boolean;
};

export type GenerateDinnerPlanInput = {
  dates: string[];
  recipes: PlanRecipeCandidate[];
  existingAssignments?: PlanAssignment[];
  rerollDates?: string[];
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

export function generateDinnerPlan(input: GenerateDinnerPlanInput): PlanAssignment[] {
  const random = input.random ?? Math.random;
  const recipes = input.recipes;

  if (recipes.length === 0) {
    return [];
  }

  const rerollDates = new Set(input.rerollDates ?? input.dates);
  const existingByDate = new Map(
    (input.existingAssignments ?? []).map((assignment) => [assignment.date, assignment]),
  );
  const preserved = input.dates
    .map((date) => existingByDate.get(date))
    .filter((assignment): assignment is PlanAssignment => {
      if (!assignment) {
        return false;
      }

      return assignment.locked || !rerollDates.has(assignment.date);
    });
  const usedRecipeIds = new Set(preserved.map((assignment) => assignment.recipeId));
  const assignments: PlanAssignment[] = [];

  for (const date of input.dates) {
    const existing = existingByDate.get(date);
    if (existing && (existing.locked || !rerollDates.has(date))) {
      assignments.push(existing);
      continue;
    }

    const unusedRecipes = recipes.filter((recipe) => !usedRecipeIds.has(recipe.id));
    const pool = unusedRecipes.length > 0 ? unusedRecipes : recipes;
    const recipe = pickRandom(pool, random);
    usedRecipeIds.add(recipe.id);
    assignments.push({ date, recipeId: recipe.id, locked: false });
  }

  return assignments;
}
