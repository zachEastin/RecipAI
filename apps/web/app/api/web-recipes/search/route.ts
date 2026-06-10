import { NextResponse } from "next/server";
import { z } from "zod";

import { searchWebRecipes } from "@/lib/web-recipes";

const searchParamsSchema = z.object({
  area: z.string().optional(),
  category: z.string().optional(),
  filterType: z.enum(["category", "area", "ingredient"]).optional(),
  filterValue: z.string().optional(),
  ingredient: z.array(z.string()).optional(),
  q: z.string().optional()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = searchParamsSchema.safeParse({
    area: url.searchParams.get("area") || undefined,
    category: url.searchParams.get("category") || undefined,
    filterType: url.searchParams.get("filterType") || undefined,
    filterValue: url.searchParams.get("filterValue") || undefined,
    ingredient: url.searchParams.getAll("ingredient"),
    q: url.searchParams.get("q") || undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Search filters are invalid." }, { status: 400 });
  }

  try {
    const searchInput: {
      query: string;
      filterType?: "category" | "area" | "ingredient";
      filterValue?: string;
      area?: string;
      category?: string;
      ingredientFilters?: string[];
    } = {
      query: parsed.data.q ?? ""
    };

    if (parsed.data.area) {
      searchInput.area = parsed.data.area;
    }

    if (parsed.data.category) {
      searchInput.category = parsed.data.category;
    }

    if (parsed.data.ingredient?.length) {
      searchInput.ingredientFilters = parsed.data.ingredient;
    }

    if (parsed.data.filterType) {
      searchInput.filterType = parsed.data.filterType;
    }

    if (parsed.data.filterValue) {
      searchInput.filterValue = parsed.data.filterValue;
    }

    const recipes = await searchWebRecipes(searchInput);

    return NextResponse.json({ recipes });
  } catch {
    return NextResponse.json(
      { error: "Web recipe search could not be completed." },
      { status: 502 },
    );
  }
}
