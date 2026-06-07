import type Database from "better-sqlite3";

import type { AiPromptMode, AiProvider, AiStructuredResult } from "@recipai/ai";

export type SaveAiRunInput = {
  provider: AiProvider;
  mode: AiPromptMode;
  prompt: string;
  sourceRecipeId: string | null;
  structuredResponse: AiStructuredResult;
  saveStatus?: "unsaved" | "saved" | "replaced";
};

export type SavedAiRun = {
  id: string;
  provider: AiProvider;
  mode: AiPromptMode;
  prompt: string;
  sourceRecipeId: string | null;
  structuredResponse: AiStructuredResult;
  saveStatus: string;
  createdAt: string;
};

export function saveAiRun(db: Database.Database, input: SaveAiRunInput): SavedAiRun {
  const id = `ai_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const saveStatus = input.saveStatus ?? "unsaved";

  db.prepare(
    `INSERT INTO ai_runs (
      id, provider, mode, prompt, source_recipe_id, structured_response_json, save_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.provider,
    input.mode,
    input.prompt,
    input.sourceRecipeId,
    JSON.stringify(input.structuredResponse),
    saveStatus,
  );

  const row = db.prepare("SELECT * FROM ai_runs WHERE id = ?").get(id) as {
    id: string;
    provider: AiProvider;
    mode: AiPromptMode;
    prompt: string;
    source_recipe_id: string | null;
    structured_response_json: string;
    save_status: string;
    created_at: string;
  };

  return {
    id: row.id,
    provider: row.provider,
    mode: row.mode,
    prompt: row.prompt,
    sourceRecipeId: row.source_recipe_id,
    structuredResponse: JSON.parse(row.structured_response_json) as AiStructuredResult,
    saveStatus: row.save_status,
    createdAt: row.created_at
  };
}
