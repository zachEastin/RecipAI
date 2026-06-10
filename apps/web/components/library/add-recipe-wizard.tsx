"use client";

import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  FilePenLine,
  Globe2,
  Link as LinkIcon,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { AiPromptMode, AiStructuredResult } from "@recipai/ai";
import { inferRecipeMealSlots, type Recipe } from "@recipai/recipes";

import { AiResultView } from "../ask/ai-result-view";
import { Button, TextArea } from "../ui";
import { RecipeEditor, type RecipeEditorDraft } from "./recipe-editor";

type WizardMode = "ai" | "url" | "web" | "manual";

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

type WebRecipeOption = {
  id: string;
  label: string;
};

type WebRecipeOptions = {
  areas: WebRecipeOption[];
  categories: WebRecipeOption[];
  ingredients: WebRecipeOption[];
};

type WebRecipeSearchResult = {
  id: string;
  title: string;
  category: string | null;
  area: string | null;
  thumbnailUrl: string | null;
  tags: string[];
};

type WebRecipeDraft = RecipeEditorDraft & {
  imageUrl: string | null;
  sourceId: string;
};

const promptChips = [
  "15-minute dinner",
  "Use leftovers",
  "Kid friendly",
  "High protein",
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
    label: "AI",
  },
  {
    body: "Paste a recipe link and review it.",
    icon: LinkIcon,
    id: "url",
    label: "URL",
  },
  {
    body: "Search recipe sources and save a result.",
    icon: Globe2,
    id: "web",
    label: "Web",
  },
  {
    body: "Type the recipe in by hand.",
    icon: FilePenLine,
    id: "manual",
    label: "Manual",
  },
];

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
  recipes,
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
  const [webQuery, setWebQuery] = useState("");
  const [showWebIngredients, setShowWebIngredients] = useState(false);
  const [webCategory, setWebCategory] = useState("");
  const [webArea, setWebArea] = useState("");
  const [webIngredients, setWebIngredients] = useState<string[]>([]);
  const [webOptions, setWebOptions] = useState<WebRecipeOptions>({
    areas: [],
    categories: [],
    ingredients: [],
  });
  const [webResults, setWebResults] = useState<WebRecipeSearchResult[]>([]);
  const [hasSearchedWeb, setHasSearchedWeb] = useState(false);
  const [webDraft, setWebDraft] = useState<WebRecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const selectedRecipe = useMemo(
    () =>
      recipes.find((recipe) => recipe.id === sourceRecipeId) ??
      recipes[0] ??
      null,
    [recipes, sourceRecipeId],
  );
  useEffect(() => {
    if (mode !== "web" || webOptions.categories.length) {
      return;
    }

    let isActive = true;

    async function loadWebOptions() {
      try {
        const response = await fetch("/api/web-recipes/options");
        const payload = (await response.json()) as {
          options?: WebRecipeOptions;
        };

        if (response.ok && payload.options && isActive) {
          setWebOptions(payload.options);
        }
      } catch {
        if (isActive) {
          setWebOptions({ areas: [], categories: [], ingredients: [] });
        }
      }
    }

    void loadWebOptions();

    return () => {
      isActive = false;
    };
  }, [mode, webOptions.categories.length]);

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
          sourceRecipeId:
            aiMode === "modify-saved-recipe" ? sourceRecipeId : undefined,
        }),
      });
      const payload = (await response.json()) as AiPromptResponse;

      if (!response.ok || !payload.result) {
        throw new Error(
          payload.error ?? "RecipAI could not create that draft.",
        );
      }

      setAiResult(payload.result);
      setAiRunId(payload.run?.id ?? null);
      setAiSourceRecipeId(
        aiMode === "modify-saved-recipe" ? sourceRecipeId : null,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "RecipAI could not create that draft.",
      );
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
        body: JSON.stringify({ url: nextUrl }),
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
        mealSlots: inferRecipeMealSlots(payload.review),
        ingredients: payload.review.ingredients,
        steps: payload.review.steps,
        provenance: "url-import",
      });
      setUrlNotes(payload.review.parserNotes ?? []);
      setUrlStatus(payload.review.parserStatus ?? null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "That URL could not be imported.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function submitUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await reviewUrlImport(url);
  }

  function clearWebFilters() {
    setWebCategory("");
    setWebArea("");
    setWebIngredients([]);
  }

  function toggleWebIngredient(ingredient: string, checked: boolean) {
    setWebIngredients((current) => {
      if (checked) {
        return current.some(
          (item) => item.toLowerCase() === ingredient.toLowerCase(),
        )
          ? current
          : [...current, ingredient];
      }

      return current.filter((item) => item !== ingredient);
    });
  }

  async function searchWeb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setWebDraft(null);
    setIsWorking(true);

    const params = new URLSearchParams();
    if (webQuery.trim()) {
      params.set("q", webQuery.trim());
    }

    if (webCategory) {
      params.set("category", webCategory);
    }

    if (webArea) {
      params.set("area", webArea);
    }

    for (const ingredient of webIngredients) {
      params.append("ingredient", ingredient);
    }

    try {
      const response = await fetch(
        `/api/web-recipes/search?${params.toString()}`,
      );
      const payload = (await response.json()) as {
        recipes?: WebRecipeSearchResult[];
        error?: string;
      };

      if (!response.ok || !payload.recipes) {
        throw new Error(
          payload.error ?? "Web recipe search could not be completed.",
        );
      }

      setWebResults(payload.recipes);
      setHasSearchedWeb(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Web recipe search could not be completed.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function reviewWebRecipe(recipeId: string) {
    setError(null);
    setIsWorking(true);

    try {
      const response = await fetch(
        `/api/web-recipes/${encodeURIComponent(recipeId)}`,
      );
      const payload = (await response.json()) as {
        draft?: WebRecipeDraft;
        error?: string;
      };

      if (!response.ok || !payload.draft) {
        throw new Error(
          payload.error ?? "That web recipe could not be loaded.",
        );
      }

      setWebDraft({
        ...payload.draft,
        mealSlots: inferRecipeMealSlots(payload.draft),
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "That web recipe could not be loaded.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="screen-stack add-wizard">
      <div className="wizard-title">
        <div>
          <h2>Add recipe</h2>
        </div>
        <Link
          className="wizard-exit-link"
          href="/library"
          aria-label="Back to library"
        >
          <ArrowLeft aria-hidden="true" size={17} />
        </Link>
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
              </div>
            </div>
            <div
              className="mode-toggle add-wizard-toggle"
              role="group"
              aria-label="AI draft type"
            >
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
                  onClick={() =>
                    setAiPrompt((current) => withChip(current, chip))
                  }
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

          {aiResult ? (
            <section className="wizard-review-panel">
              <div className="wizard-review-heading">
                <CheckCircle2 aria-hidden="true" size={20} />
                <div>
                  <h3>Review AI draft</h3>
                  <p>
                    Save it when it looks right, or revise the prompt above.
                  </p>
                </div>
              </div>
              <AiResultView
                result={aiResult}
                runId={aiRunId}
                sourceRecipeId={aiSourceRecipeId}
              />
            </section>
          ) : null}
        </section>
      ) : null}

      {mode === "url" ? (
        <section className="wizard-workspace">
          <form className="wizard-prompt-card" onSubmit={submitUrl}>
            <div className="wizard-card-heading">
              <LinkIcon aria-hidden="true" size={23} />
              <div>
                <h3>Import from URL</h3>
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
                  <p>
                    {urlNotes.join(" ") ||
                      "Imported fields are ready to edit before saving."}
                  </p>
                </div>
              </div>
              {urlStatus ? (
                <p className="wizard-import-status">
                  Parser status: {urlStatus}
                </p>
              ) : null}
              <RecipeEditor key={urlDraft.source} initialDraft={urlDraft} />
            </section>
          ) : null}
        </section>
      ) : null}

      {mode === "web" ? (
        <section className="web-search-screen" aria-label="Search web recipes">
          {webDraft ? (
            <section className="web-review-screen">
              <button
                className="web-back-button"
                onClick={() => {
                  setWebDraft(null);
                  setError(null);
                }}
                type="button"
              >
                <ArrowLeft aria-hidden="true" size={17} />
                Back to results
              </button>
              <div className="web-review-hero">
                {webDraft.imageUrl ? (
                  <Image
                    alt=""
                    height={118}
                    src={webDraft.imageUrl}
                    unoptimized
                    width={118}
                  />
                ) : (
                  <div className="web-review-image-empty">
                    <Globe2 aria-hidden="true" size={26} />
                  </div>
                )}
                <div>
                  <h3>Review recipe</h3>
                  <h4>{webDraft.title}</h4>
                  <p>{webDraft.summary}</p>
                  <div className="web-tag-row">
                    {webDraft.tags
                      .filter((tag) => tag !== "web-search")
                      .slice(0, 3)
                      .map((tag, index) => (
                        <span key={`${tag}-${index}`}>{tag}</span>
                      ))}
                  </div>
                </div>
              </div>
              <RecipeEditor key={webDraft.sourceId} initialDraft={webDraft} />
            </section>
          ) : (
            <>
              <form className="web-search-card" onSubmit={searchWeb}>
                <label className="web-search-input">
                  <Search aria-hidden="true" size={19} />
                  <input
                    aria-label="Search recipes"
                    onChange={(event) => setWebQuery(event.target.value)}
                    placeholder="Search recipes"
                    value={webQuery}
                  />
                  {webQuery ? (
                    <button
                      aria-label="Clear search"
                      onClick={() => setWebQuery("")}
                      type="button"
                    >
                      <X aria-hidden="true" size={17} />
                    </button>
                  ) : null}
                </label>
                <div className="web-filter-strip">
                  <label>
                    <span>Category</span>
                    <select
                      aria-label="Category"
                      onChange={(event) => setWebCategory(event.target.value)}
                      value={webCategory}
                    >
                      <option value="">All</option>
                      {webOptions.categories.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Cuisine</span>
                    <select
                      aria-label="Cuisine"
                      onChange={(event) => setWebArea(event.target.value)}
                      value={webArea}
                    >
                      <option value="">All</option>
                      {webOptions.areas.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    aria-expanded={showWebIngredients}
                    className="web-ingredient-strip-button"
                    onClick={() => setShowWebIngredients((value) => !value)}
                    type="button"
                  >
                    <span>Ingredients</span>
                    <strong>{webIngredients.length || "All"}</strong>
                  </button>
                </div>
                {showWebIngredients || webIngredients.length ? (
                  <section
                    className="web-filter-panel"
                    aria-label="Ingredient filters"
                  >
                    {showWebIngredients ? (
                      <div className="web-ingredient-menu">
                        <div className="web-ingredient-toggle-list">
                          {webOptions.ingredients.slice(0, 80).map((option) => {
                            const checked = webIngredients.includes(option.id);

                            return (
                              <label key={option.id}>
                                <span>{option.label}</span>
                                <input
                                  checked={checked}
                                  onChange={(event) =>
                                    toggleWebIngredient(
                                      option.id,
                                      event.target.checked,
                                    )
                                  }
                                  type="checkbox"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {webIngredients.length ? (
                      <div
                        className="web-selected-ingredients"
                        aria-label="Selected ingredients"
                      >
                        {webIngredients.map((ingredient) => (
                          <button
                            aria-label={`Remove ${ingredient}`}
                            key={ingredient}
                            onClick={() =>
                              setWebIngredients((current) =>
                                current.filter((item) => item !== ingredient),
                              )
                            }
                            type="button"
                          >
                            {ingredient}
                            <X aria-hidden="true" size={14} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="web-filter-note">
                      Free web search supports one ingredient upstream. Multiple
                      ingredients are matched after loading recipe details.
                    </div>
                    {webCategory || webArea || webIngredients.length ? (
                      <button
                        className="web-clear-filters"
                        onClick={clearWebFilters}
                        type="button"
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </section>
                ) : null}
                <Button
                  className="full-width"
                  disabled={isWorking}
                  type="submit"
                >
                  {isWorking ? "Searching..." : "Search Web"}
                </Button>
              </form>
              <section className="web-results-panel">
                <div className="web-results-heading">
                  <h3>Results</h3>
                  <span>{webResults.length}</span>
                </div>
                {webResults.length ? (
                  <div className="web-result-list">
                    {webResults.map((result) => (
                      <article className="web-result-row" key={result.id}>
                        {result.thumbnailUrl ? (
                          <Image
                            alt=""
                            height={82}
                            src={result.thumbnailUrl}
                            unoptimized
                            width={88}
                          />
                        ) : (
                          <div className="web-result-image-empty">
                            <Globe2 aria-hidden="true" size={22} />
                          </div>
                        )}
                        <div className="web-result-main">
                          <h4>{result.title}</h4>
                          <p>
                            {[result.category, result.area]
                              .filter(Boolean)
                              .join(" • ") || "Web recipe"}
                          </p>
                          <div className="web-tag-row">
                            {result.tags.slice(0, 3).map((tag, index) => (
                              <span key={`${tag}-${index}`}>{tag}</span>
                            ))}
                          </div>
                        </div>
                        <button
                          className="web-review-button"
                          disabled={isWorking}
                          onClick={() => void reviewWebRecipe(result.id)}
                          type="button"
                        >
                          Review
                        </button>
                        <button
                          aria-label={`Review ${result.title}`}
                          className="web-chevron-button"
                          disabled={isWorking}
                          onClick={() => void reviewWebRecipe(result.id)}
                          type="button"
                        >
                          <ChevronRight aria-hidden="true" size={19} />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div
                    className={
                      hasSearchedWeb
                        ? "web-empty-state web-no-results"
                        : "web-empty-state"
                    }
                  >
                    {hasSearchedWeb ? (
                      <>
                        <Search aria-hidden="true" size={24} />
                        <h3>No web recipes found</h3>
                        <p>
                          Nothing matched this search. Try fewer ingredients or
                          clear a filter.
                        </p>
                      </>
                    ) : (
                      <>
                        <Globe2 aria-hidden="true" size={24} />
                        <h3>Search recipes</h3>
                        <p>Try a recipe name, or pick a filter and search.</p>
                      </>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      ) : null}

      {mode === "manual" ? (
        <section className="wizard-review-panel">
          <div className="wizard-review-heading">
            <FilePenLine aria-hidden="true" size={20} />
            <div>
              <h3>Manual recipe</h3>
            </div>
          </div>
          <RecipeEditor initialSource={initialSource} />
        </section>
      ) : null}
    </div>
  );
}
