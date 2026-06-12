import { NextResponse } from "next/server";

import { readStoredRecipeImage } from "@/lib/recipe-images";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const image = await readStoredRecipeImage(filename);

  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const body = image.bytes.buffer.slice(
    image.bytes.byteOffset,
    image.bytes.byteOffset + image.bytes.byteLength,
  ) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": image.contentType
    }
  });
}
