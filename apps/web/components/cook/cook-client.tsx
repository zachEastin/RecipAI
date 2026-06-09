"use client";

import {
  AlarmClock,
  Check,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  TimerReset,
  Utensils,
  Volume2
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Recipe } from "@recipai/recipes";

import { Button, EmptyState } from "../ui";

const AI_DRAFT_STORAGE_KEY = "recipai-ai-cook-draft";

type WakeLockSentinel = {
  release: () => Promise<void>;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

export type CookRecipe = {
  id: string | null;
  title: string;
  summary: string;
  servings: number;
  totalMinutes: number;
  ingredients: Array<{
    id: string;
    quantity: number | null;
    unit: string | null;
    name: string;
    note: string | null;
  }>;
  steps: Array<{
    id: string;
    body: string;
    timerMinutes: number | null;
  }>;
};

type CookDraftPayload = {
  title: string;
  summary: string;
  servings: number;
  totalMinutes: number;
  ingredients: Array<{
    quantity: number | null;
    unit: string | null;
    name: string;
    note: string | null;
  }>;
  steps: Array<{
    body: string;
    timerMinutes: number | null;
  }>;
};

function recipeToCookRecipe(recipe: Recipe): CookRecipe {
  return {
    id: recipe.id,
    title: recipe.title,
    summary: recipe.summary,
    servings: recipe.servings,
    totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
    ingredients: recipe.ingredients.map((ingredient) => ({
      id: ingredient.id,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      name: ingredient.name,
      note: ingredient.note
    })),
    steps: recipe.steps.map((step) => ({
      id: step.id,
      body: step.body,
      timerMinutes: step.timerMinutes
    }))
  };
}

function draftToCookRecipe(draft: CookDraftPayload): CookRecipe {
  return {
    id: null,
    title: draft.title,
    summary: draft.summary,
    servings: draft.servings,
    totalMinutes: draft.totalMinutes,
    ingredients: draft.ingredients.map((ingredient, index) => ({
      id: `draft-ingredient-${index + 1}`,
      ...ingredient
    })),
    steps: draft.steps.map((step, index) => ({
      id: `draft-step-${index + 1}`,
      ...step
    }))
  };
}

function formatQuantity(quantity: number | null, scale: number): string {
  if (quantity === null) {
    return "";
  }

  const scaled = Number((quantity * scale).toFixed(2));
  return Number.isInteger(scaled) ? String(scaled) : String(scaled);
}

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function saveAiCookDraft(draft: CookDraftPayload): void {
  sessionStorage.setItem(AI_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function CookClient({
  recipe: initialRecipe,
  draftStorageKey
}: {
  recipe?: Recipe | null;
  draftStorageKey?: string;
}) {
  const [recipe, setRecipe] = useState<CookRecipe | null>(
    initialRecipe ? recipeToCookRecipe(initialRecipe) : null,
  );
  const [servings, setServings] = useState(initialRecipe?.servings ?? 4);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(() => new Set());
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState<Record<string, number>>({});
  const [runningTimerId, setRunningTimerId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [wakeStatus, setWakeStatus] = useState<"idle" | "on" | "unsupported">("idle");
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (recipe || !draftStorageKey) {
      return;
    }

    const rawDraft = sessionStorage.getItem(draftStorageKey);
    if (!rawDraft) {
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as CookDraftPayload;
      const cookDraft = draftToCookRecipe(draft);
      setRecipe(cookDraft);
      setServings(cookDraft.servings);
    } catch {
      setStatus("Could not open the AI draft for cooking.");
    }
  }, [draftStorageKey, recipe]);

  useEffect(() => {
    if (!runningTimerId) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimerSeconds((current) => {
        const remaining = current[runningTimerId] ?? 0;

        if (remaining <= 1) {
          setRunningTimerId(null);
          setStatus("Timer finished.");
          return { ...current, [runningTimerId]: 0 };
        }

        return { ...current, [runningTimerId]: remaining - 1 };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [runningTimerId]);

  useEffect(() => {
    return () => {
      void wakeLockRef.current?.release();
    };
  }, []);

  const activeStep = recipe?.steps[activeStepIndex] ?? null;
  const scale = recipe ? servings / recipe.servings : 1;
  const checkedCount = checkedIngredients.size;

  const initializedTimerSeconds = useMemo(() => {
    if (!activeStep?.timerMinutes) {
      return 0;
    }

    return timerSeconds[activeStep.id] ?? activeStep.timerMinutes * 60;
  }, [activeStep, timerSeconds]);

  if (!recipe) {
    return (
      <EmptyState
        action={
          <Link href="/library">
            <Button>Open library</Button>
          </Link>
        }
        body="Choose a saved recipe, planned meal, or AI result to open cooking mode."
        title="Choose a recipe to cook"
      />
    );
  }

  function toggleIngredient(id: string) {
    setCheckedIngredients((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function adjustServings(delta: number) {
    setServings((current) => Math.max(1, current + delta));
  }

  async function toggleWakeLock() {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setWakeStatus("idle");
      return;
    }

    const wakeNavigator = navigator as WakeLockNavigator;
    if (!wakeNavigator.wakeLock) {
      setWakeStatus("unsupported");
      setStatus("Screen-awake is not supported in this browser.");
      return;
    }

    try {
      wakeLockRef.current = await wakeNavigator.wakeLock.request("screen");
      setWakeStatus("on");
      setStatus("Screen will stay awake while this browser allows it.");
    } catch {
      setWakeStatus("unsupported");
      setStatus("Screen-awake could not be enabled.");
    }
  }

  function startTimer(stepId: string, minutes: number) {
    setTimerSeconds((current) => ({
      ...current,
      [stepId]: current[stepId] ?? minutes * 60
    }));
    setRunningTimerId(stepId);
  }

  function pauseTimer() {
    setRunningTimerId(null);
  }

  function resetTimer(stepId: string, minutes: number) {
    setRunningTimerId((current) => (current === stepId ? null : current));
    setTimerSeconds((current) => ({ ...current, [stepId]: minutes * 60 }));
  }

  async function markCooked() {
    const recipeId = recipe?.id;

    if (!recipeId) {
      setStatus("Cooking session completed.");
      return;
    }

    const response = await fetch(`/api/recipes/${recipeId}/cooked`, { method: "POST" });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setStatus(payload.error ?? "Could not mark this recipe cooked.");
      return;
    }

    setStatus("Marked cooked in your library.");
  }

  return (
    <div className="screen-stack cook-screen">
      <section className="cook-hero">
        <div>
          <p className="plan-date">Cooking mode</p>
          <h2>{recipe.title}</h2>
          <p>{recipe.summary}</p>
        </div>
        <div className="cook-hero-meta">
          <span>
            <Utensils aria-hidden="true" size={16} />
            {servings} servings
          </span>
          <span>
            <AlarmClock aria-hidden="true" size={16} />
            {recipe.totalMinutes} min
          </span>
        </div>
      </section>

      <section className="cook-toolbar">
        <div className="serving-stepper" aria-label="Serving scaler">
          <button aria-label="Decrease servings" onClick={() => adjustServings(-1)} type="button">
            <Minus aria-hidden="true" size={16} />
          </button>
          <strong>{servings}</strong>
          <button aria-label="Increase servings" onClick={() => adjustServings(1)} type="button">
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>
        <button
          aria-pressed={wakeStatus === "on"}
          className="wake-toggle"
          onClick={() => void toggleWakeLock()}
          type="button"
        >
          <Volume2 aria-hidden="true" size={17} />
          {wakeStatus === "on" ? "Awake on" : "Keep awake"}
        </button>
      </section>

      {status ? <p className="status-text">{status}</p> : null}

      <section className="cook-panel">
        <div className="cook-section-header">
          <div>
            <p className="plan-date">Ingredients</p>
            <h3>
              {checkedCount}/{recipe.ingredients.length} ready
            </h3>
          </div>
        </div>
        <div className="cook-ingredient-list">
          {recipe.ingredients.map((ingredient) => {
            const checked = checkedIngredients.has(ingredient.id);

            return (
              <button
                aria-pressed={checked}
                className={
                  checked ? "cook-ingredient cook-ingredient-checked" : "cook-ingredient"
                }
                data-testid={`cook-ingredient-${ingredient.id}`}
                key={ingredient.id}
                onClick={() => toggleIngredient(ingredient.id)}
                type="button"
              >
                <span>{checked ? <Check aria-hidden="true" size={18} /> : null}</span>
                <strong>
                  {formatQuantity(ingredient.quantity, scale)}
                  {ingredient.unit ? ` ${ingredient.unit}` : ""} {ingredient.name}
                </strong>
                {ingredient.note ? <em>{ingredient.note}</em> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="cook-step-panel">
        <div className="cook-section-header">
          <div>
            <p className="plan-date">
              Step {activeStepIndex + 1} of {recipe.steps.length}
            </p>
            <h3>{activeStep?.timerMinutes ? `${activeStep.timerMinutes} min timer` : "No timer"}</h3>
          </div>
        </div>

        <p className="cook-step-body">{activeStep?.body}</p>

        {activeStep?.timerMinutes ? (
          <div className="timer-box">
            <strong>{formatTimer(initializedTimerSeconds)}</strong>
            <div>
              {runningTimerId === activeStep.id ? (
                <Button onClick={pauseTimer} type="button" variant="secondary">
                  Pause
                </Button>
              ) : (
                <Button
                  onClick={() => startTimer(activeStep.id, activeStep.timerMinutes!)}
                  type="button"
                >
                  Start
                </Button>
              )}
              <button
                aria-label="Reset timer"
                className="icon-toggle"
                onClick={() => resetTimer(activeStep.id, activeStep.timerMinutes!)}
                type="button"
              >
                <TimerReset aria-hidden="true" size={17} />
              </button>
            </div>
          </div>
        ) : null}

        <div className="cook-step-actions">
          <Button
            disabled={activeStepIndex === 0}
            onClick={() => setActiveStepIndex((index) => Math.max(0, index - 1))}
            type="button"
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" size={18} />
            Back
          </Button>
          <Button
            disabled={activeStepIndex === recipe.steps.length - 1}
            onClick={() =>
              setActiveStepIndex((index) => Math.min(recipe.steps.length - 1, index + 1))
            }
            type="button"
          >
            Next
            <ChevronRight aria-hidden="true" size={18} />
          </Button>
        </div>
      </section>

      <section className="cook-panel">
        <label className="cook-notes">
          Notes while cooking
          <textarea
            data-testid="cooking-notes"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Adjustments, substitutions, timing notes..."
            value={notes}
          />
        </label>
      </section>

      <Button className="full-width cook-complete-button" onClick={markCooked} type="button">
        <ChefHat aria-hidden="true" size={18} />
        Mark cooked
      </Button>
    </div>
  );
}

export { AI_DRAFT_STORAGE_KEY };
