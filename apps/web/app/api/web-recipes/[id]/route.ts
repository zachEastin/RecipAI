import { NextResponse } from "next/server";

import { getWebRecipeDraft } from "@/lib/web-recipes";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const draft = await getWebRecipeDraft(id);

    if (!draft) {
      return NextResponse.json({ error: "Recipe was not found." }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json(
      { error: "Web recipe could not be loaded." },
      { status: 502 },
    );
  }
}
