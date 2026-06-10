import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const meal = {
  idMeal: "52772",
  strMeal: "Teriyaki Chicken Casserole",
  strCategory: "Chicken",
  strArea: "Japanese",
  strInstructions: "Cook chicken.",
  strMealThumb: "https://example.com/teriyaki.jpg",
  strTags: "Dinner",
  strIngredient1: "chicken",
  strMeasure1: "2 lbs"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web recipe search route", () => {
  it("returns source-neutral web recipe search results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ meals: [meal] })));

    const response = await GET(
      new Request("http://127.0.0.1:3000/api/web-recipes/search?q=chicken"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.recipes[0]).toMatchObject({
      id: "52772",
      title: "Teriyaki Chicken Casserole",
      category: "Chicken",
      area: "Japanese"
    });
  });

  it("accepts repeated ingredient filters", async () => {
    const fetchMock = vi.fn(async () => Response.json({ meals: [meal] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(
        "http://127.0.0.1:3000/api/web-recipes/search?q=chicken&ingredient=chicken&ingredient=garlic",
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("returns 400 for invalid filter types", async () => {
    const response = await GET(
      new Request("http://127.0.0.1:3000/api/web-recipes/search?filterType=bad"),
    );

    expect(response.status).toBe(400);
  });

  it("returns 502 when upstream search fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("failed", { status: 500 })));

    const response = await GET(
      new Request("http://127.0.0.1:3000/api/web-recipes/search?q=chicken"),
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain("could not be completed");
  });
});
