import { NextResponse } from "next/server";

import { searchRecipeImageSuggestions } from "@/lib/recipe-images";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  try {
    const images = await searchRecipeImageSuggestions(query);
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json(
      { error: "Image search could not be completed." },
      { status: 502 },
    );
  }
}
