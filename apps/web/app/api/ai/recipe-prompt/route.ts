import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type AiRunRequest,
  InvalidAiResponseError,
  MissingApiKeyError,
  aiPromptModeSchema,
  createChatAiClient,
  getConfiguredProvider
} from "@recipai/ai";
import { getRecipeById, migrate, openDatabase, saveAiRun } from "@recipai/db";

import { loadLocalEnv } from "@/lib/local-env";

const requestSchema = z.object({
  mode: aiPromptModeSchema,
  prompt: z.string().trim().min(3).max(2000),
  sourceRecipeId: z.string().optional()
});

export async function POST(request: Request) {
  loadLocalEnv();

  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Prompt needs a little more detail before RecipAI can format it." },
      { status: 400 },
    );
  }

  const db = openDatabase();
  migrate(db);

  try {
    const provider = getConfiguredProvider();
    const sourceRecipe = parsed.data.sourceRecipeId
      ? getRecipeById(db, parsed.data.sourceRecipeId)
      : null;

    if (parsed.data.mode === "modify-saved-recipe" && !sourceRecipe) {
      return NextResponse.json(
        { error: "Choose a saved recipe before asking for changes." },
        { status: 400 },
      );
    }

    const client = createChatAiClient(provider);
    const aiRequest: AiRunRequest = {
      provider,
      mode: parsed.data.mode,
      prompt: parsed.data.prompt
    };

    if (parsed.data.sourceRecipeId) {
      aiRequest.sourceRecipeId = parsed.data.sourceRecipeId;
    }

    if (sourceRecipe) {
      aiRequest.sourceRecipe = {
        title: sourceRecipe.title,
        summary: sourceRecipe.summary,
        servings: sourceRecipe.servings,
        prepMinutes: sourceRecipe.prepMinutes,
        cookMinutes: sourceRecipe.cookMinutes,
        tags: sourceRecipe.tags,
        ingredients: sourceRecipe.ingredients.map((item) => ({
          quantity: item.quantity,
          unit: item.unit,
          name: item.name,
          note: item.note
        })),
        steps: sourceRecipe.steps.map((item) => ({
          body: item.body,
          timerMinutes: item.timerMinutes
        }))
      };
    }

    const result = await client.runRecipePrompt(aiRequest);

    const savedRun = saveAiRun(db, {
      provider,
      mode: parsed.data.mode,
      prompt: parsed.data.prompt,
      sourceRecipeId: parsed.data.sourceRecipeId ?? null,
      structuredResponse: result
    });

    return NextResponse.json({ run: savedRun, result });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json(
        { error: "DeepSeek is not configured yet. Add DEEPSEEK_API_KEY to your local .env." },
        { status: 500 },
      );
    }

    if (error instanceof InvalidAiResponseError || error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "The AI response came back, but it could not be formatted as a recipe." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "RecipAI could not complete that prompt. Try again with a simpler request." },
      { status: 502 },
    );
  } finally {
    db.close();
  }
}
