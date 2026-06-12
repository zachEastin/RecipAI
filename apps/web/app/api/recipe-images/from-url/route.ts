import { NextResponse } from "next/server";
import { z } from "zod";

import { saveRecipeImageFromUrl } from "@/lib/recipe-images";

const inputSchema = z.object({
  imageUrl: z.string().trim().min(1)
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter an image URL." }, { status: 400 });
  }

  try {
    const imageUrl = await saveRecipeImageFromUrl(parsed.data.imageUrl);
    return NextResponse.json({ imageUrl });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Image URL could not be imported." },
      { status: 400 },
    );
  }
}
