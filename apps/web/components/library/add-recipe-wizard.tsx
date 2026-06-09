"use client";

import {
  Bot,
  CheckCircle2,
  ClipboardList,
  FilePenLine,
  Link as LinkIcon,
  Sparkles
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import type { AiPromptMode, AiStructuredResult } from "@recipai/ai";
import type { Recipe } from "@recipai/recipes";

import { AiResultView } from "../ask/ai-result-view";
import { Button, TextArea } from "../ui";
import { RecipeEditor, type RecipeEditorDraft } from "./recipe-editor";

type WizardMode = "ai" | "url" | "manual";
type WizardStep = "choose" | "draft" | "review";

type AiPromptResponse = {
  run?: { id: string };
  result?: AiStructuredResult;
  error?: string;
};

type ImportResponse = {
  review?: RecipeEditorDraft & {
    parserNotes?: string[];
    parserStatus?: string;
  };
  error?: string;
};

const promptChips = [
  "15-minute dinner",
  "Use leftovers",
  "Kid friendly",
  "High protein"
] as const;

const modeOptions: Array<{
  body: string;
  icon: typeof Bot;
  id: WizardMode;
  label: string;
}> = [
  {
    body: "Prompt RecipAI for a structured draft.",
    icon: Bot,
    id: "ai",
    label: "AI"
  },
  {
    body: "Paste a recipe link and review it.",
    icon: LinkIcon,
    id: "url",
    label: "URL"
  },
  {
    body: "Type the recipe in by hand.",
    icon: FilePenLine,
    id: "manual",
    label: "Manual"
  }
];

function stepForMode(mode: WizardMode, hasDraft: boolean): WizardStep {
  if (mode === "manual") {
    return "review";
  }

  return hasDraft ? "review" : "choose";
}

function withChip(prompt: string, chip: string): string {
  const trimmed = prompt.trim();

  if (!trimmed) {
    return chip;
  }

  return `${trimmed}, ${chip.toLowerCase()}`;
}

export function AddRecipeWizard({
  initialMode = "ai",
  initialSource = "",
  initialUrl = "",
  recipes
}: {
  initialMode?: WizardMode;
  initialSource?: string;
  initialUrl?: string;
  recipes: Recipe[];
}) {
  const [mode, setMode] = useState<WizardMode>(initialMode);
  const [aiPrompt, setAiPrompt] = useState(
    "Make a weeknight salmon dinner with rice and a vegetable.",
  );
  const [aiMode, setAiMode] = useState<AiPromptMode>("general-recipe");
  const [sourceRecipeId, setSourceRecipeId] = useState(recipes[0]?.id ?? "");
  const [aiResult, setAiResult] = useState<AiStructuredResult | null>(null);
  const [aiRunId, setAiRunId] = useState<string | null>(null);
  const [aiSourceRecipeId, setAiSourceRecipeId] = useState<string | null>(null);
  const [url, setUrl] = useState(initialUrl);
  const [urlDraft, setUrlDraft] = useState<RecipeEditorDraft | null>(null);
  const [urlNotes, setUrlNotes] = useState<string[]>([]);
  const [urlStatus, setUrlStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === sourceRecipeId) ?? recipes[0] ?? null,
    [recipes, sourceRecipeId],
  );
  const hasDraft = Boolean(aiResult || urlDraft);
  const activeStep = stepForMode(mode, hasDraft);

  function chooseMode(nextMode: WizardMode) {
    setMode(nextMode);
    setError(null);
  }

  async function submitAiPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsWorking(true);

    try {
      const response = await fetch("/api/ai/recipe-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: aiMode,
          prompt: aiPrompt,
          sourceRecipeId: aiMode === "modify-saved-recipe" ? sourceRecipeId : undefined
        })
      });
      const payload = (await response.json()) as AiPromptResponse;

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "RecipAI could not create that draft.");
      }

      setAiResult(payload.result);
      setAiRunId(payload.run?.id ?? null);
      setAiSourceRecipeId(aiMode === "modify-saved-recipe" ? sourceRecipeId : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "RecipAI could not create that draft.");
    } finally {
      setIsWorking(false);
    }
  }

  async function reviewUrlImport(nextUrl: string) {
    setError(null);
    setIsWorking(true);

    try {
      const response = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: nextUrl })
      });
      const payload = (await response.json()) as ImportResponse;

      if (!response.ok || !payload.review) {
        throw new Error(payload.error ?? "That URL could not be imported.");
      }

      setUrlDraft({
        title: payload.review.title,
        summary: payload.review.summary,
        source: payload.review.source,
        servings: payload.review.servings,
        prepMinutes: payload.review.prepMinutes,
        cookMinutes: payload.review.cookMinutes,
        tags: payload.review.tags,
        ingredients: payload.review.ingredients,
        steps: payload.review.steps,
        provenance: "url-import"
      });
      setUrlNotes(payload.review.parserNotes ?? []);
      setUrlStatus(payload.review.parserStatus ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That URL could not be imported.");
    } finally {
      setIsWorking(false);
    }
  }

  async function submitUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await reviewUrlImport(url);
  }

  async function submitInlineUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMode("url");
    await reviewUrlImport(url);
  }

  return (
    <div className="screen-stack add-wizard">
      <div className="wizard-title">
        <div>
          <h2>Add recipe</h2>
          <p>Choose the fastest way to get a clean recipe into your family library.</p>
        </div>
      </div>

      <section className="wizard-mode-card" aria-label="Recipe creation method">
        {modeOptions.map((option) => {
          const Icon = option.icon;

          return (
            <button
              aria-pressed={mode === option.id}
              key={option.id}
              onClick={() => chooseMode(option.id)}
              type="button"
            >
              <Icon aria-hidden="true" size={20} />
              <strong>{option.label}</strong>
              <span>{option.body}</span>
            </button>
          );
        })}
      </section>

      <div className="wizard-step-rail" aria-label="Add recipe progress">
        {(["choose", "draft", "review"] as const).map((step, index) => (
          <span
            aria-current={activeStep === step ? "step" : undefined}
            className={activeStep === step ? "wizard-step-active" : ""}
            key={step}
          >
            <i>{index + 1}</i>
            {step}
          </span>
        ))}
      </div>

      {error ? (
        <section className="error-panel">
          <strong>Draft failed</strong>
          <p>{error}</p>
        </section>
      ) : null}

      {mode === "ai" ? (
        <section className="wizard-workspace">
          <form className="wizard-prompt-card" onSubmit={submitAiPrompt}>
            <div className="wizard-card-heading">
              <Sparkles aria-hidden="true" size={23} />
              <div>
                <h3>AI recipe draft</h3>
                <p>Generate a structured result you can save, cook, or adjust.</p>
              </div>
            </div>
            <div className="mode-toggle add-wizard-toggle" role="group" aria-label="AI draft type">
              <button
                aria-pressed={aiMode === "general-recipe"}
                onClick={() => setAiMode("general-recipe")}
                type="button"
              >
                New
              </button>
              <button
                aria-pressed={aiMode === "modify-saved-recipe"}
                onClick={() => setAiMode("modify-saved-recipe")}
                type="button"
              >
                Change saved
              </button>
            </div>
            <TextArea
              aria-label="Recipe prompt"
              onChange={(event) => setAiPrompt(event.target.value)}
              rows={5}
              value={aiPrompt}
            />
            <div className="chip-row">
              {promptChips.map((chip) => (
                <button
                  className="chip"
                  key={chip}
                  onClick={() => setAiPrompt((current) => withChip(current, chip))}
                  type="button"
                >
                  {chip}
                </button>
              ))}
            </div>
            {aiMode === "modify-saved-recipe" ? (
              <label className="field-label">
                Saved recipe to change
                <select
                  className="select-input"
                  disabled={!recipes.length}
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
            {aiMode === "modify-saved-recipe" && selectedRecipe ? (
              <div className="wizard-selected-recipe">
                <strong>{selectedRecipe.title}</strong>
                <span>{selectedRecipe.summary}</span>
              </div>
            ) : null}
            <Button className="full-width" disabled={isWorking} type="submit">
              {isWorking ? "Generating draft..." : "Generate draft"}
            </Button>
          </form>

          <form className="wizard-inline-url" onSubmit={submitInlineUrl}>
            <div>
              <LinkIcon aria-hidden="true" size={19} />
              <strong>Or add from a URL</strong>
            </div>
            <div className="wizard-inline-url-row">
              <input
                aria-label="Recipe URL"
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.example.com/recipe"
                type="url"
                value={url}
              />
              <button disabled={isWorking} type="submit">
                Load
              </button>
            </div>
          </form>

          {aiResult ? (
            <section className="wizard-review-panel">
              <div className="wizard-review-heading">
                <CheckCircle2 aria-hidden="true" size={20} />
                <div>
                  <h3>Review AI draft</h3>
                  <p>Save it when it looks right, or revise the prompt above.</p>
                </div>
              </div>
              <AiResultView
                result={aiResult}
                runId={aiRunId}
                sourceRecipeId={aiSourceRecipeId}
              />
            </section>
          ) : (
            <section className="wizard-draft-empty">
              <ClipboardList aria-hidden="true" size={22} />
              <div>
                <h3>Draft preview</h3>
                <p>Your structured recipe result will appear here with ingredients, steps, and save actions.</p>
              </div>
            </section>
          )}
        </section>
      ) : null}

      {mode === "url" ? (
        <section className="wizard-workspace">
          <form className="wizard-prompt-card" onSubmit={submitUrl}>
            <div className="wizard-card-heading">
              <LinkIcon aria-hidden="true" size={23} />
              <div>
                <h3>Import from URL</h3>
                <p>Paste a recipe link, then review every field before saving.</p>
              </div>
            </div>
            <label className="field-label">
              Recipe URL
              <input
                className="wizard-input"
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/favorite-dinner"
                type="url"
                value={url}
              />
            </label>
            <Button className="full-width" disabled={isWorking} type="submit">
              {isWorking ? "Reviewing URL..." : "Review import"}
            </Button>
          </form>
          {urlDraft ? (
            <section className="wizard-review-panel">
              <div className="wizard-review-heading">
                <CheckCircle2 aria-hidden="true" size={20} />
                <div>
                  <h3>Review imported draft</h3>
                  <p>{urlNotes.join(" ") || "Imported fields are ready to edit before saving."}</p>
                </div>
              </div>
              {urlStatus ? (
                <p className="wizard-import-status">Parser status: {urlStatus}</p>
              ) : null}
              <RecipeEditor key={urlDraft.source} initialDraft={urlDraft} />
            </section>
          ) : (
            <section className="wizard-draft-empty">
              <LinkIcon aria-hidden="true" size={22} />
              <div>
                <h3>URL preview</h3>
                <p>The parsed title, ingredients, steps, and source will appear here before saving.</p>
              </div>
            </section>
          )}
        </section>
      ) : null}

      {mode === "manual" ? (
        <section className="wizard-review-panel">
          <div className="wizard-review-heading">
            <FilePenLine aria-hidden="true" size={20} />
            <div>
              <h3>Manual recipe</h3>
              <p>Use one ingredient or step per line. You can refine details after saving.</p>
            </div>
          </div>
          <RecipeEditor initialSource={initialSource} />
        </section>
      ) : null}
    </div>
  );
}
