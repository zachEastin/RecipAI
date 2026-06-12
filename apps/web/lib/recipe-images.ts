import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

import { databasePathFromUrl } from "@recipai/db";

import { loadLocalEnv } from "./local-env";

export type RecipeImageSuggestion = {
  id: string;
  imageUrl: string;
  source: "mealdb" | "pexels";
  sourceLabel: string;
  sourceUrl: string | null;
  title: string;
};

type MealDbMeal = {
  idMeal: string;
  strMeal: string;
  strMealThumb?: string | null;
  strSource?: string | null;
};

type MealDbResponse = {
  meals: MealDbMeal[] | null;
};

type PexelsPhoto = {
  id: number;
  alt?: string | null;
  photographer: string;
  photographer_url: string;
  url: string;
  src: {
    large?: string;
    medium?: string;
    original?: string;
  };
};

type PexelsResponse = {
  photos: PexelsPhoto[];
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
]);

function imageRoot(): string {
  loadLocalEnv();
  return resolve(dirname(databasePathFromUrl()), "images");
}

function localImageUrl(filename: string): string {
  return `/api/recipe-images/files/${filename}`;
}

function extensionForType(contentType: string): string | null {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_IMAGE_TYPES.get(type) ?? null;
}

export function contentTypeForFilename(filename: string): string | null {
  const extension = extname(filename).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".gif") {
    return "image/gif";
  }

  return null;
}

export function safeImagePath(filename: string): string | null {
  if (!/^[a-f0-9-]+\.(?:jpg|png|webp|gif)$/.test(filename)) {
    return null;
  }

  return join(imageRoot(), filename);
}

async function saveImageBytes(bytes: Uint8Array, contentType: string): Promise<string> {
  const extension = extensionForType(contentType);

  if (!extension) {
    throw new Error("Choose a JPG, PNG, WebP, or GIF image.");
  }

  if (bytes.byteLength <= 0) {
    throw new Error("Choose a non-empty image file.");
  }

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 8 MB.");
  }

  const root = imageRoot();
  await mkdir(root, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  await writeFile(join(root, filename), bytes);
  return localImageUrl(filename);
}

export async function saveUploadedRecipeImage(file: File): Promise<string> {
  return saveImageBytes(new Uint8Array(await file.arrayBuffer()), file.type);
}

export async function saveRecipeImageFromUrl(imageUrl: string): Promise<string> {
  let url: URL;

  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error("Enter a valid image URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Image URL must start with http or https.");
  }

  const response = await fetch(url, {
    headers: { "User-Agent": "RecipAI local recipe image importer" }
  });

  if (!response.ok) {
    throw new Error("Image URL could not be loaded.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!extensionForType(contentType)) {
    throw new Error("Image URL must point to a JPG, PNG, WebP, or GIF image.");
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 8 MB.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return saveImageBytes(bytes, contentType);
}

export async function readStoredRecipeImage(filename: string): Promise<{
  bytes: Buffer;
  contentType: string;
} | null> {
  const path = safeImagePath(filename);
  const contentType = contentTypeForFilename(filename);

  if (!path || !contentType) {
    return null;
  }

  try {
    return { bytes: await readFile(path), contentType };
  } catch {
    return null;
  }
}

function mealDbUrl(path: string, params: Record<string, string>): URL {
  loadLocalEnv();
  const key = process.env.THEMEALDB_API_KEY?.trim() || "1";
  const url = new URL(`https://www.themealdb.com/api/json/v1/${key}/${path}`);

  for (const [name, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(name, value);
    }
  }

  return url;
}

async function searchMealDbImages(query: string): Promise<RecipeImageSuggestion[]> {
  const response = await fetch(mealDbUrl("search.php", { s: query }), {
    headers: { "User-Agent": "RecipAI local recipe image search" }
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as MealDbResponse;
  return (payload.meals ?? [])
    .filter((meal) => meal.strMealThumb)
    .slice(0, 8)
    .map((meal) => ({
      id: `mealdb-${meal.idMeal}`,
      imageUrl: meal.strMealThumb!,
      source: "mealdb",
      sourceLabel: "TheMealDB",
      sourceUrl: meal.strSource ?? null,
      title: meal.strMeal
    }));
}

async function searchPexelsImages(query: string): Promise<RecipeImageSuggestion[]> {
  loadLocalEnv();
  const apiKey = process.env.PEXELS_API_KEY?.trim();

  if (!apiKey) {
    return [];
  }

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", `${query} recipe food`);
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", "landscape");

  const response = await fetch(url, {
    headers: { Authorization: apiKey }
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as PexelsResponse;
  return payload.photos.slice(0, 8).map((photo) => ({
    id: `pexels-${photo.id}`,
    imageUrl: photo.src.large ?? photo.src.medium ?? photo.src.original ?? "",
    source: "pexels" as const,
    sourceLabel: `Pexels · ${photo.photographer}`,
    sourceUrl: photo.url || photo.photographer_url,
    title: photo.alt?.trim() || query
  })).filter((suggestion) => suggestion.imageUrl);
}

export async function searchRecipeImageSuggestions(query: string): Promise<RecipeImageSuggestion[]> {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const [mealDbSuggestions, pexelsSuggestions] = await Promise.all([
    searchMealDbImages(trimmed),
    searchPexelsImages(trimmed)
  ]);

  return [...mealDbSuggestions, ...pexelsSuggestions].slice(0, 12);
}
