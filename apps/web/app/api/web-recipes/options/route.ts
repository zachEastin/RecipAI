import { NextResponse } from "next/server";

import { listWebRecipeOptions } from "@/lib/web-recipes";

export async function GET() {
  try {
    return NextResponse.json({ options: await listWebRecipeOptions() });
  } catch {
    return NextResponse.json(
      { error: "Web recipe filters could not be loaded." },
      { status: 502 },
    );
  }
}
