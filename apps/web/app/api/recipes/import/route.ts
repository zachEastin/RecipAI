import { NextResponse } from "next/server";
import { z } from "zod";

import { parseRecipeUrl } from "@/lib/recipe-url-parser";

const schema = z.object({
  url: z.string().url()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid recipe URL." }, { status: 400 });
  }

  return NextResponse.json({ review: await parseRecipeUrl(parsed.data.url) });
}
