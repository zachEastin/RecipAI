import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as POST_FROM_URL } from "./from-url/route";
import { GET as GET_FILE } from "./files/[filename]/route";
import { GET as GET_SEARCH } from "./search/route";
import { POST as POST_UPLOAD } from "./upload/route";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "recipai-recipe-images-route-"));
  process.env.DATABASE_URL = `file:${join(tempDir, "recipai.sqlite")}`;
  process.env.RECIPAI_WORKSPACE_ROOT = "/";
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.PEXELS_API_KEY;
  delete process.env.RECIPAI_WORKSPACE_ROOT;
  vi.unstubAllGlobals();
  rmSync(tempDir, { force: true, recursive: true });
});

function storedFilename(imageUrl: string): string {
  return imageUrl.split("/").at(-1) ?? "";
}

describe("recipe image API routes", () => {
  it("stores uploaded image files and serves them back", async () => {
    const formData = new FormData();
    formData.set(
      "image",
      new File([new Uint8Array([1, 2, 3])], "thumb.png", {
        type: "image/png"
      }),
    );

    const response = await POST_UPLOAD(
      new Request("http://127.0.0.1:3000/api/recipe-images/upload", {
        method: "POST",
        body: formData
      }),
    );
    const payload = await response.json();
    const filename = storedFilename(payload.imageUrl);
    const fileResponse = await GET_FILE(
      new Request(`http://127.0.0.1:3000/api/recipe-images/files/${filename}`),
      { params: Promise.resolve({ filename }) },
    );

    expect(response.status).toBe(200);
    expect(payload.imageUrl).toMatch(/^\/api\/recipe-images\/files\/.+\.png$/);
    expect(existsSync(join(tempDir, "images", filename))).toBe(true);
    expect(fileResponse.headers.get("content-type")).toBe("image/png");
  });

  it("rejects non-image uploads", async () => {
    const formData = new FormData();
    formData.set(
      "image",
      new File(["not image"], "notes.txt", {
        type: "text/plain"
      }),
    );

    const response = await POST_UPLOAD(
      new Request("http://127.0.0.1:3000/api/recipe-images/upload", {
        method: "POST",
        body: formData
      }),
    );

    expect(response.status).toBe(400);
  });

  it("copies valid image URLs into local storage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/jpeg" }
        }),
      ),
    );

    const response = await POST_FROM_URL(
      new Request("http://127.0.0.1:3000/api/recipe-images/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: "https://example.com/photo.jpg" })
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.imageUrl).toMatch(/^\/api\/recipe-images\/files\/.+\.jpg$/);
    expect(existsSync(join(tempDir, "images", storedFilename(payload.imageUrl)))).toBe(true);
  });

  it("returns MealDB and Pexels image suggestions when both are available", async () => {
    process.env.PEXELS_API_KEY = "pexels-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.includes("themealdb.com")) {
          return Response.json({
            meals: [
              {
                idMeal: "52772",
                strMeal: "Chicken Pasta",
                strMealThumb: "https://www.themealdb.com/chicken.jpg",
                strSource: "https://www.themealdb.com/meal"
              }
            ]
          });
        }

        return Response.json({
          photos: [
            {
              id: 123,
              alt: "Chicken pasta",
              photographer: "A Cook",
              photographer_url: "https://www.pexels.com/@cook",
              url: "https://www.pexels.com/photo/chicken-pasta",
              src: { large: "https://images.pexels.com/photos/123/large.jpg" }
            }
          ]
        });
      }),
    );

    const response = await GET_SEARCH(
      new Request("http://127.0.0.1:3000/api/recipe-images/search?q=chicken"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.images).toEqual([
      expect.objectContaining({
        id: "mealdb-52772",
        source: "mealdb",
        sourceLabel: "TheMealDB"
      }),
      expect.objectContaining({
        id: "pexels-123",
        source: "pexels",
        sourceLabel: "Pexels · A Cook"
      })
    ]);
  });
});
