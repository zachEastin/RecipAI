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
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

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

type FloatingTimerMode = "compact" | "full";

type TimerPosition = {
  x: number;
  y: number;
};

type TimerDragState = {
  mode: FloatingTimerMode;
  originX: number;
  originY: number;
  pointerId: number;
  startX: number;
  startY: number;
  wasDragged: boolean;
};

const FLOATING_TIMER_MARGIN = 16;
const FLOATING_TIMER_NAV_CLEARANCE = 84;
const COMPACT_TIMER_SIZE = 88;
const FULL_TIMER_HEIGHT = 126;
const FULL_TIMER_MAX_WIDTH = 508;

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

function viewportSize(): { height: number; width: number } {
  if (typeof window === "undefined") {
    return { height: 844, width: 390 };
  }

  return {
    height: window.innerHeight,
    width: window.innerWidth
  };
}

function fullTimerWidth(): number {
  const { width } = viewportSize();
  return Math.min(FULL_TIMER_MAX_WIDTH, width - FLOATING_TIMER_MARGIN * 2);
}

function clampPosition(position: TimerPosition, mode: FloatingTimerMode): TimerPosition {
  const { height, width } = viewportSize();
  const widgetWidth = mode === "full" ? fullTimerWidth() : COMPACT_TIMER_SIZE;
  const widgetHeight = mode === "full" ? FULL_TIMER_HEIGHT : COMPACT_TIMER_SIZE;
  const maxX = Math.max(FLOATING_TIMER_MARGIN, width - widgetWidth - FLOATING_TIMER_MARGIN);
  const maxY = Math.max(
    FLOATING_TIMER_MARGIN,
    height - widgetHeight - FLOATING_TIMER_NAV_CLEARANCE,
  );

  return {
    x: Math.min(Math.max(position.x, FLOATING_TIMER_MARGIN), maxX),
    y: Math.min(Math.max(position.y, FLOATING_TIMER_MARGIN), maxY)
  };
}

function defaultTimerPosition(mode: FloatingTimerMode): TimerPosition {
  const { height, width } = viewportSize();

  return clampPosition(
    mode === "full"
      ? {
          x: FLOATING_TIMER_MARGIN,
          y: height - FULL_TIMER_HEIGHT - FLOATING_TIMER_NAV_CLEARANCE
        }
      : {
          x: width - COMPACT_TIMER_SIZE - FLOATING_TIMER_MARGIN,
          y: height - COMPACT_TIMER_SIZE - FLOATING_TIMER_NAV_CLEARANCE
        },
    mode,
  );
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
  const [floatingTimerId, setFloatingTimerId] = useState<string | null>(null);
  const [floatingTimerMode, setFloatingTimerMode] =
    useState<FloatingTimerMode>("compact");
  const [timerPosition, setTimerPosition] = useState<TimerPosition>({ x: 24, y: 128 });
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [wakeStatus, setWakeStatus] = useState<"idle" | "on" | "unsupported">("idle");
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const timerDragRef = useRef<TimerDragState | null>(null);

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

  useEffect(() => {
    function handleResize() {
      setTimerPosition((current) => clampPosition(current, floatingTimerMode));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [floatingTimerMode]);

  const activeStep = recipe?.steps[activeStepIndex] ?? null;
  const scale = recipe ? servings / recipe.servings : 1;
  const checkedCount = checkedIngredients.size;
  const floatingTimerIndex = recipe?.steps.findIndex((step) => step.id === floatingTimerId) ?? -1;
  const floatingTimerStep =
    floatingTimerIndex >= 0 && recipe ? recipe.steps[floatingTimerIndex] ?? null : null;
  const floatingTimerTotalSeconds = (floatingTimerStep?.timerMinutes ?? 0) * 60;
  const floatingTimerRemainingSeconds = floatingTimerStep
    ? (timerSeconds[floatingTimerStep.id] ?? floatingTimerTotalSeconds)
    : 0;
  const floatingTimerProgress = floatingTimerTotalSeconds
    ? 1 - floatingTimerRemainingSeconds / floatingTimerTotalSeconds
    : 0;

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
    if (!floatingTimerId) {
      setTimerPosition(defaultTimerPosition(floatingTimerMode));
    }
    setFloatingTimerId(stepId);
    setRunningTimerId(stepId);
  }

  function pauseTimer() {
    setRunningTimerId(null);
  }

  function resetTimer(stepId: string, minutes: number) {
    setRunningTimerId((current) => (current === stepId ? null : current));
    setTimerSeconds((current) => ({ ...current, [stepId]: minutes * 60 }));
    setFloatingTimerId(stepId);
  }

  function toggleFloatingTimerMode() {
    setFloatingTimerMode((current) => {
      const next = current === "compact" ? "full" : "compact";
      setTimerPosition((position) => clampPosition(position, next));
      return next;
    });
  }

  function goToFloatingTimerStep() {
    if (floatingTimerIndex >= 0) {
      setActiveStepIndex(floatingTimerIndex);
      setStatus(`Returned to step ${floatingTimerIndex + 1}.`);
    }
  }

  function handleFloatingTimerPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    timerDragRef.current = {
      mode: floatingTimerMode,
      originX: timerPosition.x,
      originY: timerPosition.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      wasDragged: false
    };
  }

  function handleFloatingTimerPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = timerDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.wasDragged = true;
    }

    setTimerPosition(
      clampPosition(
        drag.mode === "full"
          ? { x: drag.originX, y: drag.originY + deltaY }
          : { x: drag.originX + deltaX, y: drag.originY + deltaY },
        drag.mode,
      ),
    );
  }

  function handleFloatingTimerPointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = timerDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    timerDragRef.current = null;

    if (!drag.wasDragged) {
      toggleFloatingTimerMode();
    }
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
      {floatingTimerStep ? (
        <div
          aria-label={`Step ${floatingTimerIndex + 1} timer, ${formatTimer(floatingTimerRemainingSeconds)} left`}
          className={
            floatingTimerMode === "full"
              ? "floating-timer floating-timer-full"
              : "floating-timer floating-timer-compact"
          }
          data-testid="floating-cook-timer"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleFloatingTimerMode();
            }
          }}
          onPointerDown={handleFloatingTimerPointerDown}
          onPointerMove={handleFloatingTimerPointerMove}
          onPointerUp={handleFloatingTimerPointerUp}
          role="button"
          style={{
            left: timerPosition.x,
            top: timerPosition.y,
            width:
              floatingTimerMode === "full"
                ? `min(${FULL_TIMER_MAX_WIDTH}px, calc(100vw - ${FLOATING_TIMER_MARGIN * 2}px))`
                : COMPACT_TIMER_SIZE
          }}
          tabIndex={0}
        >
          {floatingTimerMode === "compact" ? (
            <div className="floating-timer-circle">
              <svg aria-hidden="true" viewBox="0 0 80 80">
                <circle className="floating-timer-track" cx="40" cy="40" r="34" />
                <circle
                  className="floating-timer-progress"
                  cx="40"
                  cy="40"
                  r="34"
                  style={{
                    strokeDashoffset: 213.63 * (1 - floatingTimerProgress)
                  }}
                />
              </svg>
              <strong>{formatTimer(floatingTimerRemainingSeconds)}</strong>
              <span>Step {floatingTimerIndex + 1}</span>
            </div>
          ) : (
            <div className="floating-timer-full-content">
              <div className="floating-timer-full-header">
                <span>Step {floatingTimerIndex + 1}</span>
                <strong>{formatTimer(floatingTimerRemainingSeconds)}</strong>
              </div>
              <div className="floating-timer-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, floatingTimerProgress * 100))}%` }} />
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  goToFloatingTimerStep();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                type="button"
              >
                Back to step {floatingTimerIndex + 1}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export { AI_DRAFT_STORAGE_KEY };
