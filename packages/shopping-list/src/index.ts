export type ShoppingListIngredientInput = {
  quantity: number | null;
  unit: string | null;
  name: string;
  groceryCategory?: string | null;
};

export type AggregatedShoppingListItem = {
  quantity: number | null;
  unit: string | null;
  name: string;
  groceryCategory: string;
};

const UNIT_ALIASES = new Map([
  ["cups", "cup"],
  ["cup", "cup"],
  ["c", "cup"],
  ["tablespoons", "tbsp"],
  ["tablespoon", "tbsp"],
  ["tbsp", "tbsp"],
  ["tbsps", "tbsp"],
  ["teaspoons", "tsp"],
  ["teaspoon", "tsp"],
  ["tsp", "tsp"],
  ["tsps", "tsp"],
  ["ounces", "oz"],
  ["ounce", "oz"],
  ["oz", "oz"],
  ["pounds", "lb"],
  ["pound", "lb"],
  ["lbs", "lb"],
  ["lb", "lb"],
  ["grams", "g"],
  ["gram", "g"],
  ["g", "g"],
  ["kilograms", "kg"],
  ["kilogram", "kg"],
  ["kg", "kg"],
  ["cloves", "clove"],
  ["clove", "clove"],
  ["cans", "can"],
  ["can", "can"],
  ["jars", "jar"],
  ["jar", "jar"],
  ["bunches", "bunch"],
  ["bunch", "bunch"],
  ["heads", "head"],
  ["head", "head"],
  ["packages", "package"],
  ["package", "package"],
  ["packs", "pack"],
  ["pack", "pack"]
]);

const LEADING_DESCRIPTORS = /^(fresh|frozen|dried|dry|canned|jarred|large|small|medium)\s+/;
const TRAILING_PARENTHETICAL = /\s*\([^)]*\)\s*/g;

export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(TRAILING_PARENTHETICAL, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_DESCRIPTORS, "")
    .replace(/\b(tomatoes|potatoes)\b/g, (match) => match.slice(0, -2))
    .replace(/\b([a-z]{4,})s\b/g, "$1");
}

export function normalizeShoppingUnit(unit: string | null): string | null {
  const trimmed = unit?.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  return UNIT_ALIASES.get(trimmed) ?? trimmed;
}

function mergeKey(item: ShoppingListIngredientInput): string | null {
  const normalizedName = normalizeIngredientName(item.name);
  const normalizedUnit = normalizeShoppingUnit(item.unit);

  if (!normalizedName || item.quantity === null) {
    return null;
  }

  return `${normalizedName}::${normalizedUnit ?? "unitless"}`;
}

function displayQuantity(value: number): number {
  return Number(value.toFixed(3));
}

export function aggregateIngredients(
  ingredients: ShoppingListIngredientInput[],
): AggregatedShoppingListItem[] {
  const merged = new Map<string, AggregatedShoppingListItem>();
  const separate: AggregatedShoppingListItem[] = [];

  for (const ingredient of ingredients) {
    const name = ingredient.name.trim();

    if (!name) {
      continue;
    }

    const item: AggregatedShoppingListItem = {
      quantity: ingredient.quantity,
      unit: normalizeShoppingUnit(ingredient.unit),
      name,
      groceryCategory: ingredient.groceryCategory?.trim() || "Other"
    };
    const key = mergeKey(ingredient);

    if (!key) {
      separate.push(item);
      continue;
    }

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item });
      continue;
    }

    existing.quantity = displayQuantity((existing.quantity ?? 0) + (item.quantity ?? 0));
    if (existing.groceryCategory === "Other" && item.groceryCategory !== "Other") {
      existing.groceryCategory = item.groceryCategory;
    }
  }

  return [...merged.values(), ...separate].sort((a, b) => {
    if (a.groceryCategory !== b.groceryCategory) {
      return a.groceryCategory.localeCompare(b.groceryCategory);
    }

    return a.name.localeCompare(b.name);
  });
}
