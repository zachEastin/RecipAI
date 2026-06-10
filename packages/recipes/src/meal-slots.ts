import { MEAL_SLOTS, type MealSlot } from "./types";

const breakfastWords = [
  "breakfast",
  "brunch",
  "oat",
  "oats",
  "pancake",
  "waffle",
  "egg",
  "eggs",
  "granola",
  "smoothie"
];

const lunchWords = [
  "lunch",
  "sandwich",
  "wrap",
  "salad",
  "bento",
  "grain bowl",
  "rice bowl",
  "soup"
];

const dinnerWords = [
  "dinner",
  "supper",
  "weeknight",
  "pasta",
  "skillet",
  "sheet-pan",
  "chicken",
  "salmon",
  "beef",
  "turkey",
  "sausage"
];

function hasAny(value: string, words: string[]): boolean {
  return words.some((word) => value.includes(word));
}

export function normalizeMealSlots(slots: readonly string[] | undefined): MealSlot[] {
  const normalized = (slots ?? []).filter((slot): slot is MealSlot =>
    (MEAL_SLOTS as readonly string[]).includes(slot),
  );

  return [...new Set(normalized)].length > 0 ? [...new Set(normalized)] : ["dinner"];
}

export function inferRecipeMealSlots(input: {
  title: string;
  tags?: readonly string[];
  summary?: string;
}): MealSlot[] {
  const text = [input.title, input.summary ?? "", ...(input.tags ?? [])]
    .join(" ")
    .toLowerCase();
  const slots: MealSlot[] = [];

  if (hasAny(text, breakfastWords)) {
    slots.push("breakfast");
  }

  if (hasAny(text, lunchWords)) {
    slots.push("lunch");
  }

  if (hasAny(text, dinnerWords)) {
    slots.push("dinner");
  }

  return normalizeMealSlots(slots);
}
