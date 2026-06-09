export type RecipeImportReview = {
  source: string;
  title: string;
  summary: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  ingredients: string[];
  steps: string[];
  parserStatus: "fallback" | "parsed";
  parserNotes: string[];
};

function titleFromUrl(url: string): string {
  const parsed = new URL(url);
  const lastPath = parsed.pathname
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replaceAll("-", " ")
    .replaceAll("_", " ");

  return lastPath ? lastPath.replace(/\b\w/g, (letter) => letter.toUpperCase()) : parsed.hostname;
}

function textFromHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDuration(value: unknown): number {
  if (typeof value !== "string") {
    return 0;
  }

  const hours = value.match(/(\d+(?:\.\d+)?)H/);
  const minutes = value.match(/(\d+(?:\.\d+)?)M/);

  return Math.round(Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0));
}

function parseYield(value: unknown): number {
  if (typeof value === "number") {
    return Math.max(1, Math.round(value));
  }

  if (Array.isArray(value)) {
    return parseYield(value[0]);
  }

  if (typeof value === "string") {
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : 4;
  }

  return 4;
}

function arrayify<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function findRecipeJsonLd(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeJsonLd(item);
      if (found) {
        return found;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type : [type];

  if (types.some((item) => typeof item === "string" && item.toLowerCase() === "recipe")) {
    return record;
  }

  return findRecipeJsonLd(record["@graph"]);
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const scripts = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const script of scripts ?? []) {
    const match = script.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const content = match?.[1]?.trim();

    if (!content) {
      continue;
    }

    try {
      const found = findRecipeJsonLd(JSON.parse(content));
      if (found) {
        return found;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractFallbackTitle(html: string, url: string): string {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  return textFromHtml(ogTitle?.[1] ?? title?.[1] ?? titleFromUrl(url));
}

function instructionText(value: unknown): string {
  if (typeof value === "string") {
    return textFromHtml(value);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textFromHtml(String(record.text ?? record.name ?? ""));
  }

  return "";
}

export async function parseRecipeUrl(url: string): Promise<RecipeImportReview> {
  const fallback = {
    source: url,
    title: titleFromUrl(url),
    summary: "Review and fill in this imported recipe before saving.",
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    tags: ["imported"],
    ingredients: [],
    steps: [],
    parserStatus: "fallback" as const,
    parserNotes: ["No recipe metadata was found. Review and fill in the missing fields."]
  };

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "RecipAI local recipe importer"
      }
    });

    if (!response.ok) {
      return {
        ...fallback,
        parserNotes: [`The page returned HTTP ${response.status}. Review manually.`]
      };
    }

    const html = await response.text();
    const recipe = extractJsonLd(html);

    if (!recipe) {
      return {
        ...fallback,
        title: extractFallbackTitle(html, url)
      };
    }

    const instructions = arrayify(recipe.recipeInstructions)
      .map(instructionText)
      .filter(Boolean);

    return {
      source: url,
      title: textFromHtml(String(recipe.name ?? extractFallbackTitle(html, url))),
      summary: textFromHtml(String(recipe.description ?? "Imported recipe. Review before saving.")),
      servings: parseYield(recipe.recipeYield ?? recipe.yield),
      prepMinutes: parseDuration(recipe.prepTime),
      cookMinutes: parseDuration(recipe.cookTime) || parseDuration(recipe.totalTime),
      tags: [
        "imported",
        ...arrayify(recipe.recipeCategory)
          .flatMap((item) => String(item).split(","))
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      ],
      ingredients: arrayify(recipe.recipeIngredient).map((item) => textFromHtml(String(item))),
      steps: instructions,
      parserStatus: "parsed",
      parserNotes: ["Recipe metadata was parsed from JSON-LD. Review quantities and steps."]
    };
  } catch {
    return {
      ...fallback,
      parserNotes: ["The page could not be fetched. Review manually."]
    };
  }
}
