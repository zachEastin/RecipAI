export type PlanRecipeCandidate = {
  id: string;
  title: string;
  mealSlots?: MealSlot[];
  prepMinutes?: number;
  cookMinutes?: number;
  rating?: number;
  favorite?: boolean;
  lastCookedAt?: string | null;
  tags?: string[];
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
  avoidRecentMeals?: boolean;
  preferQuickWeekdays?: boolean;
  addVariety?: boolean;
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

function totalMinutes(recipe: PlanRecipeCandidate): number {
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
}

function strongestTag(recipe: PlanRecipeCandidate): string | null {
  return recipe.tags?.[0]?.toLowerCase() ?? null;
}

function isWeekday(date: string): boolean {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day >= 1 && day <= 5;
}

function daysSince(value: string | null | undefined, now = new Date()): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

function isEligibleForSlot(recipe: PlanRecipeCandidate, mealSlot: MealSlot): boolean {
  return (recipe.mealSlots ?? ["dinner"]).includes(mealSlot);
}

function targetKey(target: PlanTarget): string {
  return `${target.date}::${target.mealSlot}`;
}

function scoreRecipe(input: {
  recipe: PlanRecipeCandidate;
  target: PlanTarget;
  previousRecipe: PlanRecipeCandidate | null;
  avoidRecentMeals: boolean;
  preferQuickWeekdays: boolean;
  addVariety: boolean;
}): number {
  const { recipe, target, previousRecipe } = input;
  let score = 100;

  score += (recipe.rating ?? 0) * 4;
  if (recipe.favorite) {
    score += 8;
  }

  if (input.avoidRecentMeals) {
    const cookedDaysAgo = daysSince(recipe.lastCookedAt);
    if (cookedDaysAgo !== null) {
      if (cookedDaysAgo < 7) {
        score -= 40;
      } else if (cookedDaysAgo < 21) {
        score -= 18;
      }
    }
  }

  if (input.preferQuickWeekdays && isWeekday(target.date)) {
    const minutes = totalMinutes(recipe);
    const quickLimit = target.mealSlot === "dinner" ? 35 : 20;

    if (minutes > quickLimit) {
      score -= Math.min(35, minutes - quickLimit);
    } else {
      score += 6;
    }
  }

  if (
    input.addVariety &&
    previousRecipe &&
    strongestTag(recipe) &&
    strongestTag(recipe) === strongestTag(previousRecipe)
  ) {
    score -= 22;
  }

  return Math.max(1, score);
}

function pickScoredRecipe(input: {
  recipes: PlanRecipeCandidate[];
  target: PlanTarget;
  previousRecipe: PlanRecipeCandidate | null;
  avoidRecentMeals: boolean;
  preferQuickWeekdays: boolean;
  addVariety: boolean;
  random: () => number;
}): PlanRecipeCandidate {
  const scored = input.recipes
    .map((recipe) => ({
      recipe,
      score: scoreRecipe({ ...input, recipe })
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.recipe.title.localeCompare(b.recipe.title);
    });
  const candidates = scored.slice(0, Math.min(4, scored.length));
  const total = candidates.reduce((sum, item) => sum + item.score, 0);
  let cursor = input.random() * total;

  for (const item of candidates) {
    cursor -= item.score;
    if (cursor <= 0) {
      return item.recipe;
    }
  }

  return candidates.at(-1)?.recipe ?? pickRandom(input.recipes, input.random);
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
  const avoidRecentMeals = input.avoidRecentMeals ?? true;
  const preferQuickWeekdays = input.preferQuickWeekdays ?? true;
  const addVariety = input.addVariety ?? true;
  const existingByDate = new Map(
    (input.existingAssignments ?? []).map((assignment) => [targetKey(assignment), assignment]),
  );
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
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
    const repeatAwarePool = avoidRepeats && unusedRecipes.length > 0 ? unusedRecipes : recipes;
    let eligiblePool = repeatAwarePool.filter((recipe) =>
      isEligibleForSlot(recipe, target.mealSlot),
    );
    if (eligiblePool.length === 0 && repeatAwarePool !== recipes) {
      eligiblePool = recipes.filter((recipe) => isEligibleForSlot(recipe, target.mealSlot));
    }

    if (eligiblePool.length === 0) {
      continue;
    }

    const previousAssignment = assignments.at(-1);
    const previousRecipe = previousAssignment
      ? recipeById.get(previousAssignment.recipeId) ?? null
      : null;
    const recipe = pickScoredRecipe({
      recipes: eligiblePool,
      target,
      previousRecipe,
      avoidRecentMeals,
      preferQuickWeekdays,
      addVariety,
      random
    });
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
