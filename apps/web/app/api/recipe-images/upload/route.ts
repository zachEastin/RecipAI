import { NextResponse } from "next/server";

import { saveUploadedRecipeImage } from "@/lib/recipe-images";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  try {
    const imageUrl = await saveUploadedRecipeImage(file);
    return NextResponse.json({ imageUrl });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Image could not be saved." },
      { status: 400 },
    );
  }
}
