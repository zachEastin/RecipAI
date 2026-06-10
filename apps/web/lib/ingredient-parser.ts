export type ParsedIngredient = {
  quantity: number | null;
  unit: string | null;
  name: string;
  note: string | null;
  groceryCategory: string;
};

const FRACTIONS = new Map([
  ["¼", 1 / 4],
  ["½", 1 / 2],
  ["¾", 3 / 4],
  ["⅐", 1 / 7],
  ["⅑", 1 / 9],
  ["⅒", 1 / 10],
  ["⅓", 1 / 3],
  ["⅔", 2 / 3],
  ["⅕", 1 / 5],
  ["⅖", 2 / 5],
  ["⅗", 3 / 5],
  ["⅘", 4 / 5],
  ["⅙", 1 / 6],
  ["⅚", 5 / 6],
  ["⅛", 1 / 8],
  ["⅜", 3 / 8],
  ["⅝", 5 / 8],
  ["⅞", 7 / 8]
]);

const UNIT_ALIASES = new Map([
  ["c", "cup"],
  ["cup", "cup"],
  ["cups", "cup"],
  ["tbsp", "tbsp"],
  ["tbsp.", "tbsp"],
  ["tbs", "tbsp"],
  ["tbs.", "tbsp"],
  ["tablespoon", "tbsp"],
  ["tablespoons", "tbsp"],
  ["tablespoon(s)", "tbsp"],
  ["tablespoon(s)s", "tbsp"],
  ["tsp", "tsp"],
  ["tsp.", "tsp"],
  ["teaspoon", "tsp"],
  ["teaspoons", "tsp"],
  ["teaspoon(s)", "tsp"],
  ["teaspoon(s)s", "tsp"],
  ["oz", "oz"],
  ["oz.", "oz"],
  ["ounce", "oz"],
  ["ounces", "oz"],
  ["lb", "lb"],
  ["lb.", "lb"],
  ["lbs", "lb"],
  ["lbs.", "lb"],
  ["pound", "lb"],
  ["pounds", "lb"],
  ["g", "g"],
  ["gram", "g"],
  ["grams", "g"],
  ["kg", "kg"],
  ["kilogram", "kg"],
  ["kilograms", "kg"],
  ["ml", "ml"],
  ["milliliter", "ml"],
  ["milliliters", "ml"],
  ["l", "l"],
  ["liter", "l"],
  ["liters", "l"],
  ["clove", "clove"],
  ["cloves", "clove"],
  ["can", "can"],
  ["cans", "can"],
  ["jar", "jar"],
  ["jars", "jar"],
  ["bunch", "bunch"],
  ["bunches", "bunch"],
  ["head", "head"],
  ["heads", "head"],
  ["package", "package"],
  ["packages", "package"],
  ["packet", "packet"],
  ["packets", "packet"],
  ["pack", "pack"],
  ["packs", "pack"],
  ["slice", "slice"],
  ["slices", "slice"],
  ["stick", "stick"],
  ["sticks", "stick"],
  ["sprig", "sprig"],
  ["sprigs", "sprig"]
]);

const UNIT_TO_TSP = new Map([
  ["tsp", 1],
  ["tbsp", 3],
  ["cup", 48]
]);

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeFractionGlyphs(value: string): string {
  return [...value]
    .map((char) => {
      const fraction = FRACTIONS.get(char);
      return fraction === undefined ? char : ` ${decimalToFractionText(fraction)} `;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function decimalToFractionText(value: number): string {
  const known = [
    [1 / 2, "1/2"],
    [1 / 3, "1/3"],
    [2 / 3, "2/3"],
    [1 / 4, "1/4"],
    [3 / 4, "3/4"],
    [1 / 8, "1/8"],
    [3 / 8, "3/8"],
    [5 / 8, "5/8"],
    [7 / 8, "7/8"]
  ] as const;
  return known.find(([decimal]) => Math.abs(decimal - value) < 0.001)?.[1] ?? String(value);
}

function parseQuantityToken(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return denominator ? numerator / denominator : null;
  }

  const decimal = Number(trimmed);
  return Number.isFinite(decimal) ? decimal : null;
}

function readQuantity(value: string): { quantity: number; rest: string } | null {
  const normalized = normalizeFractionGlyphs(value);
  const mixed = normalized.match(/^(\d+(?:\.\d+)?)\s+(\d+\/\d+)\b\s*(.*)$/);
  if (mixed) {
    const whole = parseQuantityToken(mixed[1]!);
    const fraction = parseQuantityToken(mixed[2]!);
    if (whole !== null && fraction !== null) {
      return { quantity: whole + fraction, rest: mixed[3]!.trim() };
    }
  }

  const simple = normalized.match(/^(\d+\/\d+|\d+(?:\.\d+)?)\b\s*(.*)$/);
  if (!simple) {
    return null;
  }

  const quantity = parseQuantityToken(simple[1]!);
  return quantity === null ? null : { quantity, rest: simple[2]!.trim() };
}

export function parseIngredientQuantityInput(value: string): number | null {
  const parsed = readQuantity(value.trim());
  return parsed && !parsed.rest ? formatQuantity(parsed.quantity) : null;
}

function normalizeUnit(value: string | undefined): string | null {
  const key = value?.trim().toLowerCase();
  return key ? UNIT_ALIASES.get(key) ?? null : null;
}

function extractLeadingParenthetical(value: string): { note: string | null; rest: string } {
  const match = value.match(/^\(([^)]*)\)\s*(.*)$/);
  if (!match) {
    return { note: null, rest: value };
  }

  return { note: cleanNote(match[1]!), rest: match[2]!.trim() };
}

function extractParentheticalNotes(value: string): { name: string; notes: string[] } {
  const notes: string[] = [];
  const name = value
    .replace(/\(+([^()]*)\)+/g, (_, content: string) => {
      const note = cleanNote(content);
      if (note) {
        notes.push(note);
      }
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  return { name, notes };
}

function extractTrailingNote(value: string): { name: string; note: string | null } {
  const match = value.match(/^(.*?),\s*((?:about|to taste|don't|don’t|do not|optional|divided)\b.*)$/i);
  if (!match) {
    return { name: value, note: null };
  }

  return {
    name: match[1]!.trim(),
    note: cleanNote(match[2]!)
  };
}

function cleanNote(value: string): string | null {
  const cleaned = value
    .replace(/^[,\s]+/, "")
    .replace(/[,\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function joinNotes(notes: Array<string | null>): string | null {
  const compact = notes.filter((note): note is string => Boolean(note));
  return compact.length ? [...new Set(compact)].join("; ") : null;
}

function stripEach(value: string): { note: string | null; rest: string } {
  const match = value.match(/^each:?\s*(.*)$/i);
  if (!match) {
    return { note: null, rest: value };
  }

  return { note: "each", rest: match[1]!.trim() };
}

function formatQuantity(value: number): number {
  return Number(value.toFixed(3));
}

function parseSingleAmount(value: string): {
  quantity: number;
  unit: string | null;
  note: string | null;
  rest: string;
} | null {
  const parsedQuantity = readQuantity(value);
  if (!parsedQuantity) {
    return null;
  }

  const parenthetical = extractLeadingParenthetical(parsedQuantity.rest);
  const words = parenthetical.rest.split(/\s+/).filter(Boolean);
  const unit = normalizeUnit(words[0]);
  const rest = unit ? words.slice(1).join(" ") : parenthetical.rest;

  return {
    quantity: parsedQuantity.quantity,
    unit,
    note: parenthetical.note,
    rest: rest.trim()
  };
}

function parseAdditiveAmount(value: string): {
  quantity: number;
  unit: string | null;
  notes: string[];
  rest: string;
} | null {
  const first = parseSingleAmount(value);
  if (!first || !first.unit || !first.rest.startsWith("+")) {
    return null;
  }

  const second = parseSingleAmount(first.rest.slice(1).trim());
  if (!second || !second.unit) {
    return null;
  }

  const firstScale = UNIT_TO_TSP.get(first.unit);
  const secondScale = UNIT_TO_TSP.get(second.unit);
  if (!firstScale || !secondScale) {
    return null;
  }

  const totalTsp = first.quantity * firstScale + second.quantity * secondScale;
  return {
    quantity: formatQuantity(totalTsp / firstScale),
    unit: first.unit,
    notes: [first.note, second.note].filter((note): note is string => Boolean(note)),
    rest: second.rest
  };
}

export function parseIngredientLine(line: string): ParsedIngredient {
  const cleaned = cleanLine(line);
  const additive = parseAdditiveAmount(cleaned);
  const single = additive
    ? {
        quantity: additive.quantity,
        unit: additive.unit,
        note: joinNotes(additive.notes),
        rest: additive.rest
      }
    : parseSingleAmount(cleaned);

  if (!single) {
    const notes = extractParentheticalNotes(cleaned);
    const trailing = extractTrailingNote(notes.name);
    return {
      quantity: null,
      unit: null,
      name: trailing.name || notes.name || cleaned,
      note: joinNotes([...notes.notes, trailing.note]),
      groceryCategory: "Other"
    };
  }

  const each = stripEach(single.rest);
  const notes = extractParentheticalNotes(each.rest);
  const trailing = extractTrailingNote(notes.name);

  return {
    quantity: formatQuantity(single.quantity),
    unit: single.unit,
    name: trailing.name || notes.name || each.rest || cleaned,
    note: joinNotes([single.note, each.note, ...notes.notes, trailing.note]),
    groceryCategory: "Other"
  };
}
