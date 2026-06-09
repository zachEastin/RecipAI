import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  url: z.string().url()
});

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

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid recipe URL." }, { status: 400 });
  }

  const url = parsed.data.url;

  return NextResponse.json({
    review: {
      source: url,
      title: titleFromUrl(url),
      summary: "Review and fill in this imported recipe before saving.",
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 20,
      tags: ["imported"],
      ingredients: [],
      steps: [],
      parserStatus: "placeholder"
    }
  });
}
