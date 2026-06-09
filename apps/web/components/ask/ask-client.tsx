"use client";

import { useMemo, useState, type FormEvent } from "react";

import type { AiPromptMode, AiStructuredResult } from "@recipai/ai";
import type { Recipe } from "@recipai/recipes";

import { AiResultView } from "./ai-result-view";
import { Button, Chip, SectionHeader, TextArea } from "../ui";

type AiPromptResponse = {
  run?: { id: string };
  result?: AiStructuredResult;
  error?: string;
};

const promptChips = [
  "Faster dinner",
  "Use leftovers",
  "Healthier",
  "Kid friendly"
] as const;

export function AskClient({
  recipes,
  initialResult
}: {
  recipes: Recipe[];
  initialResult: AiStructuredResult;
}) {
  const [prompt, setPrompt] = useState(
    "Make a fast dinner with chicken, rice, and something fresh.",
  );
  const [mode, setMode] = useState<AiPromptMode>("general-recipe");
  const [sourceRecipeId, setSourceRecipeId] = useState(recipes[0]?.id ?? "");
  const [result, setResult] = useState<AiStructuredResult>(initialResult);
  const [resultRunId, setResultRunId] = useState<string | null>(null);
  const [resultSourceRecipeId, setResultSourceRecipeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === sourceRecipeId) ?? recipes[0],
    [recipes, sourceRecipeId],
  );

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/recipe-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt,
          sourceRecipeId: mode === "modify-saved-recipe" ? sourceRecipeId : undefined
        })
      });
      const payload = (await response.json()) as AiPromptResponse;

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "RecipAI could not format that result.");
      }

      setResult(payload.result);
      setResultRunId(payload.run?.id ?? null);
      setResultSourceRecipeId(mode === "modify-saved-recipe" ? sourceRecipeId : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "RecipAI could not run that prompt.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="screen-stack">
      <form className="prompt-panel" onSubmit={submitPrompt}>
        <div className="prompt-heading">
          <span className="sparkle-mark" aria-hidden="true">
            ✦
          </span>
          <div>
            <h2>Ask for a recipe</h2>
            <p>Get a structured recipe you can save, plan, shop, or cook.</p>
          </div>
        </div>
        <div className="mode-toggle" role="group" aria-label="Prompt mode">
          <button
            aria-pressed={mode === "general-recipe"}
            onClick={() => setMode("general-recipe")}
            type="button"
          >
            New recipe
          </button>
          <button
            aria-pressed={mode === "modify-saved-recipe"}
            onClick={() => setMode("modify-saved-recipe")}
            type="button"
          >
            Change saved
          </button>
        </div>
        <TextArea
          aria-label="Recipe prompt"
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          value={prompt}
        />
        <div className="chip-row">
          {promptChips.map((chip) => (
            <Chip key={chip}>{chip}</Chip>
          ))}
        </div>
        {mode === "modify-saved-recipe" ? (
          <label className="field-label">
            Saved recipe
            <select
              className="select-input"
              onChange={(event) => setSourceRecipeId(event.target.value)}
              value={sourceRecipeId}
            >
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button className="full-width" disabled={isLoading} type="submit">
          {isLoading ? "Formatting recipe..." : "Generate recipe"}
        </Button>
      </form>

      {mode === "modify-saved-recipe" && selectedRecipe ? (
        <section className="panel">
          <SectionHeader title="Modify a saved recipe" />
          <div className="select-recipe-row">
            <div>
              <strong>{selectedRecipe.title}</strong>
              <span>Ask for changes without losing the original.</span>
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="error-panel">
          <strong>Recipe formatting failed</strong>
          <p>{error}</p>
        </section>
      ) : null}

      <section>
        <SectionHeader title="Structured result" />
        <AiResultView
          result={result}
          runId={resultRunId}
          sourceRecipeId={resultSourceRecipeId}
        />
      </section>
    </div>
  );
}
