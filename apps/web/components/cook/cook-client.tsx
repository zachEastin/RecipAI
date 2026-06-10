"use client";

import {
  AlarmClock,
  Check,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Dice5,
  Filter,
  Globe2,
  Heart,
  Minus,
  Plus,
  Search,
  Shuffle,
  SlidersHorizontal,
  Star,
  TimerReset,
  Utensils,
  Volume2,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from "react";

import type { MealSlot, Recipe } from "@recipai/recipes";
import type { MealPlanEntry } from "@recipai/db";

import { Button } from "../ui";
import { filterRecipes } from "../library/recipe-filters";

const AI_DRAFT_STORAGE_KEY = "recipai-ai-cook-draft";
const WEB_DRAFT_STORAGE_KEY = "recipai-web-cook-draft";

const MEAL_SLOTS: Array<{ key: MealSlot; label: string }> = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

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

type WebRecipeDraft = {
  sourceId: string;
  title: string;
  summary: string;
  source: string | null;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  ingredients: string[];
  steps: string[];
  imageUrl: string | null;
  provenance: Recipe["provenance"];
};

type CookSearchMode = "saved" | "web";

type SlotPickerTarget = {
  date: string;
  mealSlot: MealSlot;
};

type MealPlanSaveResponse = {
  entries?: MealPlanEntry[];
  error?: string;
};

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
      note: ingredient.note,
    })),
    steps: recipe.steps.map((step) => ({
      id: step.id,
      body: step.body,
      timerMinutes: step.timerMinutes,
    })),
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
      ...ingredient,
    })),
    steps: draft.steps.map((step, index) => ({
      id: `draft-step-${index + 1}`,
      ...step,
    })),
  };
}

function webDraftToCookDraft(draft: WebRecipeDraft): CookDraftPayload {
  return {
    title: draft.title,
    summary: draft.summary,
    servings: draft.servings,
    totalMinutes: draft.prepMinutes + draft.cookMinutes,
    ingredients: draft.ingredients.map((ingredient) => ({
      quantity: null,
      unit: null,
      name: ingredient,
      note: null,
    })),
    steps: draft.steps.map((step) => ({
      body: step,
      timerMinutes: null,
    })),
  };
}

function dateFromIso(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function formatCookDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(dateFromIso(value));
}

function slotLabel(mealSlot: MealSlot): string {
  return MEAL_SLOTS.find((slot) => slot.key === mealSlot)?.label ?? mealSlot;
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
    width: window.innerWidth,
  };
}

function fullTimerWidth(): number {
  const { width } = viewportSize();
  return Math.min(FULL_TIMER_MAX_WIDTH, width - FLOATING_TIMER_MARGIN * 2);
}

function clampPosition(
  position: TimerPosition,
  mode: FloatingTimerMode,
): TimerPosition {
  const { height, width } = viewportSize();
  const widgetWidth = mode === "full" ? fullTimerWidth() : COMPACT_TIMER_SIZE;
  const widgetHeight = mode === "full" ? FULL_TIMER_HEIGHT : COMPACT_TIMER_SIZE;
  const maxX = Math.max(
    FLOATING_TIMER_MARGIN,
    width - widgetWidth - FLOATING_TIMER_MARGIN,
  );
  const maxY = Math.max(
    FLOATING_TIMER_MARGIN,
    height - widgetHeight - FLOATING_TIMER_NAV_CLEARANCE,
  );

  return {
    x: Math.min(Math.max(position.x, FLOATING_TIMER_MARGIN), maxX),
    y: Math.min(Math.max(position.y, FLOATING_TIMER_MARGIN), maxY),
  };
}

function defaultTimerPosition(mode: FloatingTimerMode): TimerPosition {
  const { height, width } = viewportSize();

  return clampPosition(
    mode === "full"
      ? {
          x: FLOATING_TIMER_MARGIN,
          y: height - FULL_TIMER_HEIGHT - FLOATING_TIMER_NAV_CLEARANCE,
        }
      : {
          x: width - COMPACT_TIMER_SIZE - FLOATING_TIMER_MARGIN,
          y: height - COMPACT_TIMER_SIZE - FLOATING_TIMER_NAV_CLEARANCE,
        },
    mode,
  );
}

export function saveAiCookDraft(draft: CookDraftPayload): void {
  sessionStorage.setItem(AI_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function saveWebCookDraft(draft: CookDraftPayload): void {
  sessionStorage.setItem(WEB_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function CookClient({
  recipe: initialRecipe,
  draftStorageKey,
  recipes: initialRecipes = [],
  today,
  todaysMeals = [],
}: {
  recipe?: Recipe | null;
  draftStorageKey?: string;
  recipes?: Recipe[];
  today?: string;
  todaysMeals?: MealPlanEntry[];
}) {
  const [recipe, setRecipe] = useState<CookRecipe | null>(
    initialRecipe ? recipeToCookRecipe(initialRecipe) : null,
  );
  const [recipes] = useState(initialRecipes);
  const [todayEntries, setTodayEntries] = useState(todaysMeals);
  const [servings, setServings] = useState(initialRecipe?.servings ?? 4);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState<Record<string, number>>({});
  const [runningTimerId, setRunningTimerId] = useState<string | null>(null);
  const [floatingTimerId, setFloatingTimerId] = useState<string | null>(null);
  const [floatingTimerMode, setFloatingTimerMode] =
    useState<FloatingTimerMode>("compact");
  const [timerPosition, setTimerPosition] = useState<TimerPosition>({
    x: 24,
    y: 128,
  });
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [wakeStatus, setWakeStatus] = useState<"idle" | "on" | "unsupported">(
    "idle",
  );
  const [searchMode, setSearchMode] = useState<CookSearchMode>("saved");
  const [query, setQuery] = useState("");
  const [areSavedFiltersOpen, setAreSavedFiltersOpen] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [recentOnly, setRecentOnly] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientThreshold, setIngredientThreshold] = useState(1);
  const [webOptions, setWebOptions] = useState<WebRecipeOptions>({
    areas: [],
    categories: [],
    ingredients: [],
  });
  const [webResults, setWebResults] = useState<WebRecipeSearchResult[]>([]);
  const [webCategory, setWebCategory] = useState("all");
  const [webArea, setWebArea] = useState("all");
  const [webIngredient, setWebIngredient] = useState("all");
  const [isWebFiltersOpen, setIsWebFiltersOpen] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [slotPickerTarget, setSlotPickerTarget] =
    useState<SlotPickerTarget | null>(null);
  const [isPlanningMeal, setIsPlanningMeal] = useState(false);
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
  const floatingTimerIndex =
    recipe?.steps.findIndex((step) => step.id === floatingTimerId) ?? -1;
  const floatingTimerStep =
    floatingTimerIndex >= 0 && recipe
      ? (recipe.steps[floatingTimerIndex] ?? null)
      : null;
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

  const plannedRecipeBySlot = useMemo(() => {
    const bySlot = new Map<MealSlot, Recipe>();

    for (const entry of todayEntries) {
      if (entry.recipe) {
        bySlot.set(entry.mealSlot, entry.recipe);
      }
    }

    return bySlot;
  }, [todayEntries]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const savedRecipe of recipes) {
      for (const tag of savedRecipe.tags) {
        tags.add(tag);
      }
    }

    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const availableIngredients = useMemo(() => {
    const ingredients = new Map<string, string>();

    for (const savedRecipe of recipes) {
      for (const ingredient of savedRecipe.ingredients) {
        const name = ingredient.name.trim();
        if (name) {
          ingredients.set(name.toLowerCase(), name);
        }
      }
    }

    return [...ingredients.values()].sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const ingredientOptions = useMemo(
    () =>
      availableIngredients.filter(
        (ingredient) => !selectedIngredients.includes(ingredient),
      ),
    [availableIngredients, selectedIngredients],
  );

  const filteredRecipes = useMemo(
    () =>
      filterRecipes(recipes, {
        favoriteOnly,
        ingredientThreshold,
        minRating,
        query,
        recentOnly,
        selectedIngredients,
        tagFilter,
      }),
    [
      favoriteOnly,
      ingredientThreshold,
      minRating,
      query,
      recentOnly,
      recipes,
      selectedIngredients,
      tagFilter,
    ],
  );

  const savedFilterCount =
    (favoriteOnly ? 1 : 0) +
    (recentOnly ? 1 : 0) +
    (tagFilter !== "all" ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    selectedIngredients.length;
  const webFilterCount =
    (webCategory !== "all" ? 1 : 0) +
    (webArea !== "all" ? 1 : 0) +
    (webIngredient !== "all" ? 1 : 0);

  useEffect(() => {
    if (recipe || webOptions.categories.length > 0) {
      return;
    }

    let cancelled = false;

    async function loadOptions() {
      try {
        const response = await fetch("/api/web-recipes/options");
        const payload = (await response.json()) as {
          options?: WebRecipeOptions;
        };

        if (!cancelled && payload.options) {
          setWebOptions(payload.options);
        }
      } catch {
        if (!cancelled) {
          setStatus("Web recipe filters could not be loaded.");
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [recipe, webOptions.categories.length]);

  if (!recipe) {
    function addIngredientFilter(ingredient: string) {
      if (ingredient === "all") {
        return;
      }

      setSelectedIngredients((current) =>
        current.includes(ingredient) ? current : [...current, ingredient],
      );
      setIngredientThreshold((current) => Math.max(1, current));
    }

    function removeIngredientFilter(ingredient: string) {
      setSelectedIngredients((current) =>
        current.filter((item) => item !== ingredient),
      );
    }

    function clearSavedFilters() {
      setFavoriteOnly(false);
      setRecentOnly(false);
      setTagFilter("all");
      setMinRating(0);
      setSelectedIngredients([]);
      setIngredientThreshold(1);
    }

    function openSlotPicker(mealSlot: MealSlot) {
      if (!today) {
        setStatus("Today could not be resolved for planning.");
        return;
      }

      setSearchMode("saved");
      setQuery("");
      setTagFilter("all");
      setMinRating(0);
      setFavoriteOnly(false);
      setRecentOnly(false);
      setSelectedIngredients([]);
      setIngredientThreshold(1);
      setAreSavedFiltersOpen(false);
      setSlotPickerTarget({ date: today, mealSlot });
      setStatus(null);
    }

    async function savePlannedMeal(
      target: SlotPickerTarget,
      selectedRecipe: Recipe,
    ) {
      setIsPlanningMeal(true);
      setStatus(null);

      try {
        const response = await fetch("/api/meal-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: [
              {
                date: target.date,
                mealSlot: target.mealSlot,
                recipeId: selectedRecipe.id,
                locked: true,
              },
            ],
          }),
        });
        const payload = (await response.json()) as MealPlanSaveResponse;

        if (!response.ok || !payload.entries) {
          throw new Error(payload.error ?? "Could not set this meal.");
        }

        setTodayEntries(payload.entries);
        setSlotPickerTarget(null);
        setStatus(
          `${selectedRecipe.title} set for ${slotLabel(target.mealSlot).toLowerCase()}.`,
        );
      } catch (caught) {
        setStatus(
          caught instanceof Error ? caught.message : "Could not set this meal.",
        );
      } finally {
        setIsPlanningMeal(false);
      }
    }

    async function planRandomMeal(mealSlot: MealSlot) {
      if (!today) {
        setStatus("Today could not be resolved for planning.");
        return;
      }

      const eligibleRecipes = recipes.filter((savedRecipe) =>
        savedRecipe.mealSlots.includes(mealSlot),
      );
      const pool = eligibleRecipes.length > 0 ? eligibleRecipes : recipes;
      const randomRecipe = pool[Math.floor(Math.random() * pool.length)];

      if (!randomRecipe) {
        setStatus("Add saved recipes before choosing a random meal.");
        return;
      }

      await savePlannedMeal({ date: today, mealSlot }, randomRecipe);
    }

    async function searchWeb(event?: FormEvent<HTMLFormElement>) {
      event?.preventDefault();
      setSearchMode("web");
      setIsSearchingWeb(true);
      setStatus(null);

      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("q", query.trim());
      }
      if (webCategory !== "all") {
        params.set("category", webCategory);
      }
      if (webArea !== "all") {
        params.set("area", webArea);
      }
      if (webIngredient !== "all") {
        params.append("ingredient", webIngredient);
      }

      try {
        const response = await fetch(
          `/api/web-recipes/search?${params.toString()}`,
        );
        const payload = (await response.json()) as {
          error?: string;
          recipes?: WebRecipeSearchResult[];
        };

        if (!response.ok || !payload.recipes) {
          throw new Error(
            payload.error ?? "Web recipe search could not be completed.",
          );
        }

        setWebResults(payload.recipes);
      } catch (caught) {
        setStatus(
          caught instanceof Error
            ? caught.message
            : "Web recipe search failed.",
        );
      } finally {
        setIsSearchingWeb(false);
      }
    }

    async function cookWebRecipe(recipeId: string) {
      setStatus(null);

      try {
        const response = await fetch(`/api/web-recipes/${recipeId}`);
        const payload = (await response.json()) as {
          draft?: WebRecipeDraft;
          error?: string;
        };

        if (!response.ok || !payload.draft) {
          throw new Error(payload.error ?? "Web recipe could not be loaded.");
        }

        saveWebCookDraft(webDraftToCookDraft(payload.draft));
        window.location.assign("/cook?draft=web");
      } catch (caught) {
        setStatus(
          caught instanceof Error
            ? caught.message
            : "Web recipe could not be opened.",
        );
      }
    }

    const hasSavedResults = filteredRecipes.length > 0;
    const todayLabel = today ? formatCookDate(today) : "Today";
    const pickerRecipes = slotPickerTarget
      ? filteredRecipes.filter(({ recipe: filteredRecipe }) =>
          filteredRecipe.mealSlots.includes(slotPickerTarget.mealSlot),
        )
      : [];
    const pickerFallbackRecipes =
      slotPickerTarget && pickerRecipes.length === 0
        ? filteredRecipes
        : pickerRecipes;

    return (
      <div className="screen-stack cook-start-screen">
        <section className="cook-today-panel">
          <div className="cook-start-heading">
            <div>
              <p className="plan-date">Today</p>
              <h2>{todayLabel}</h2>
            </div>
            <Utensils aria-hidden="true" size={22} />
          </div>

          <div className="cook-meal-list">
            {MEAL_SLOTS.map((slot) => {
              const plannedRecipe = plannedRecipeBySlot.get(slot.key) ?? null;

              return (
                <article
                  className={`cook-meal-row cook-meal-row-${slot.key}`}
                  key={slot.key}
                >
                  <div className="cook-meal-slot">
                    <span>
                      <i className={`meal-slot-marker meal-bar-${slot.key}`} />
                      {slot.label}
                    </span>
                    {plannedRecipe ? (
                      <>
                        <strong>{plannedRecipe.title}</strong>
                        <p>
                          {plannedRecipe.prepMinutes +
                            plannedRecipe.cookMinutes}{" "}
                          min · {plannedRecipe.servings} servings
                        </p>
                      </>
                    ) : (
                      <>
                        <strong>No meal planned</strong>
                        <p>
                          Pick from saved recipes or let RecipAI choose one.
                        </p>
                      </>
                    )}
                  </div>
                  <div className="cook-meal-actions">
                    {plannedRecipe ? (
                      <>
                        <button
                          aria-label={`Choose random ${slot.label.toLowerCase()}`}
                          disabled={isPlanningMeal}
                          onClick={() => void planRandomMeal(slot.key)}
                          type="button"
                        >
                          <Dice5 aria-hidden="true" size={16} />
                        </button>
                        <button
                          aria-label={`Choose ${slot.label.toLowerCase()}`}
                          onClick={() => openSlotPicker(slot.key)}
                          type="button"
                        >
                          <Search aria-hidden="true" size={16} />
                        </button>
                        <button
                          className="cook-inline-button cook-inline-button-primary"
                          onClick={() =>
                            window.location.assign(
                              `/cook?recipeId=${plannedRecipe.id}`,
                            )
                          }
                          type="button"
                        >
                          <ChefHat aria-hidden="true" size={16} />
                          Cook
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          aria-label={`Choose random ${slot.label.toLowerCase()}`}
                          disabled={isPlanningMeal}
                          onClick={() => void planRandomMeal(slot.key)}
                          type="button"
                        >
                          <Dice5 aria-hidden="true" size={16} />
                        </button>
                        <button
                          aria-label={`Choose ${slot.label.toLowerCase()}`}
                          onClick={() => openSlotPicker(slot.key)}
                          type="button"
                        >
                          <Search aria-hidden="true" size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {slotPickerTarget ? (
            <section
              className="cook-slot-picker"
              aria-label={`${slotLabel(slotPickerTarget.mealSlot)} picker`}
            >
              <div className="cook-picker-heading">
                <div>
                  <p className="plan-date">
                    {slotLabel(slotPickerTarget.mealSlot)}
                  </p>
                  <h3>Choose a meal for today</h3>
                </div>
                <button onClick={() => setSlotPickerTarget(null)} type="button">
                  <X aria-hidden="true" size={16} />
                  Close
                </button>
              </div>

              <form
                className="cook-search-form"
                onSubmit={(event) => event.preventDefault()}
              >
                <Search aria-hidden="true" size={18} />
                <input
                  aria-label={`Search ${slotLabel(slotPickerTarget.mealSlot)} recipes`}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${slotLabel(slotPickerTarget.mealSlot).toLowerCase()} recipes`}
                  value={query}
                />
              </form>

              <div className="cook-search-controls">
                <p className="cook-picker-count">
                  {pickerFallbackRecipes.length} saved recipe
                  {pickerFallbackRecipes.length === 1 ? "" : "s"}
                </p>
                <button
                  className="cook-filter-toggle"
                  onClick={() => setAreSavedFiltersOpen((value) => !value)}
                  type="button"
                >
                  <SlidersHorizontal aria-hidden="true" size={16} />
                  Filters
                  {savedFilterCount > 0 ? (
                    <span>{savedFilterCount}</span>
                  ) : null}
                </button>
              </div>

              {areSavedFiltersOpen ? (
                <div
                  className="cook-filter-panel"
                  aria-label="Saved recipe filters"
                >
                  <button
                    aria-pressed={favoriteOnly}
                    onClick={() => setFavoriteOnly((value) => !value)}
                    type="button"
                  >
                    <Heart aria-hidden="true" size={15} />
                    Favorites
                  </button>
                  <button
                    aria-pressed={recentOnly}
                    onClick={() => setRecentOnly((value) => !value)}
                    type="button"
                  >
                    <Shuffle aria-hidden="true" size={15} />
                    Recent
                  </button>
                  <label>
                    Tag
                    <select
                      onChange={(event) => setTagFilter(event.target.value)}
                      value={tagFilter}
                    >
                      <option value="all">All</option>
                      {availableTags.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Rating
                    <select
                      onChange={(event) =>
                        setMinRating(Number(event.target.value))
                      }
                      value={minRating}
                    >
                      <option value={0}>Any</option>
                      <option value={3}>3+</option>
                      <option value={4}>4+</option>
                      <option value={5}>5</option>
                    </select>
                  </label>
                  <label>
                    Ingredient
                    <select
                      aria-label="Add ingredient filter"
                      onChange={(event) =>
                        addIngredientFilter(event.target.value)
                      }
                      value="all"
                    >
                      <option value="all">Add</option>
                      {ingredientOptions.map((ingredient) => (
                        <option key={ingredient} value={ingredient}>
                          {ingredient}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedIngredients.length > 0 ? (
                    <label>
                      Match
                      <select
                        aria-label="Ingredient match threshold"
                        onChange={(event) =>
                          setIngredientThreshold(Number(event.target.value))
                        }
                        value={Math.min(
                          ingredientThreshold,
                          selectedIngredients.length,
                        )}
                      >
                        {selectedIngredients.map((ingredient, index) => (
                          <option key={ingredient} value={index + 1}>
                            {index + 1}+
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {savedFilterCount > 0 ? (
                    <button
                      className="cook-clear-filter"
                      onClick={clearSavedFilters}
                      type="button"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              ) : null}

              {selectedIngredients.length > 0 ? (
                <div
                  className="web-selected-ingredients"
                  aria-label="Selected ingredient filters"
                >
                  {selectedIngredients.map((ingredient) => (
                    <button
                      aria-label={`Remove ${ingredient}`}
                      key={ingredient}
                      onClick={() => removeIngredientFilter(ingredient)}
                      type="button"
                    >
                      {ingredient}
                      <X aria-hidden="true" size={14} />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="cook-picker-results">
                {pickerFallbackRecipes.length > 0 ? (
                  pickerFallbackRecipes
                    .slice(0, 8)
                    .map(({ ingredientMatchCount, recipe: pickerRecipe }) => {
                      const isPreferredSlot = pickerRecipe.mealSlots.includes(
                        slotPickerTarget.mealSlot,
                      );

                      return (
                        <article
                          className="cook-result-row"
                          key={pickerRecipe.id}
                        >
                          {pickerRecipe.imageUrl ? (
                            <Image
                              alt=""
                              height={58}
                              src={pickerRecipe.imageUrl}
                              unoptimized
                              width={58}
                            />
                          ) : (
                            <div className="cook-result-thumb">
                              <ChefHat aria-hidden="true" size={20} />
                            </div>
                          )}
                          <div className="cook-result-main">
                            <h3>{pickerRecipe.title}</h3>
                            <p>{pickerRecipe.summary}</p>
                            <div className="cook-result-meta">
                              <span>
                                {pickerRecipe.prepMinutes +
                                  pickerRecipe.cookMinutes}{" "}
                                min
                              </span>
                              <span>
                                <Star
                                  aria-hidden="true"
                                  fill="currentColor"
                                  size={13}
                                />
                                {pickerRecipe.rating}
                              </span>
                              {!isPreferredSlot ? (
                                <span>
                                  Not marked for{" "}
                                  {slotLabel(
                                    slotPickerTarget.mealSlot,
                                  ).toLowerCase()}
                                </span>
                              ) : null}
                              {selectedIngredients.length > 0 ? (
                                <span>
                                  {ingredientMatchCount}/
                                  {selectedIngredients.length} ingredients
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            className="cook-inline-button cook-inline-button-primary"
                            disabled={isPlanningMeal}
                            onClick={() =>
                              void savePlannedMeal(
                                slotPickerTarget,
                                pickerRecipe,
                              )
                            }
                            type="button"
                          >
                            Set
                          </button>
                        </article>
                      );
                    })
                ) : (
                  <div className="web-empty-state">
                    <Filter aria-hidden="true" size={28} />
                    <h3>No saved recipes found</h3>
                    <p>Try a different search or clear filters.</p>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </section>

        {status ? <p className="status-text">{status}</p> : null}

        <section className="cook-search-panel" id="cook-search">
          <div className="cook-start-heading">
            <div>
              <p className="plan-date">Start cooking</p>
              <h2>Search saved or web recipes</h2>
            </div>
            <ChefHat aria-hidden="true" size={22} />
          </div>

          <form
            className="cook-search-form"
            onSubmit={
              searchMode === "web"
                ? searchWeb
                : (event) => event.preventDefault()
            }
          >
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="Search saved or web recipes"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved or web recipes"
              value={query}
            />
            {searchMode === "web" ? (
              <button disabled={isSearchingWeb} type="submit">
                {isSearchingWeb ? "Searching" : "Search"}
              </button>
            ) : null}
          </form>

          <div className="cook-search-controls">
            <div
              className="mode-toggle cook-mode-toggle"
              aria-label="Recipe source"
            >
              <button
                aria-pressed={searchMode === "saved"}
                onClick={() => setSearchMode("saved")}
                type="button"
              >
                Saved
              </button>
              <button
                aria-pressed={searchMode === "web"}
                onClick={() => setSearchMode("web")}
                type="button"
              >
                Web
              </button>
            </div>
            <button
              className="cook-filter-toggle"
              onClick={() =>
                searchMode === "saved"
                  ? setAreSavedFiltersOpen((value) => !value)
                  : setIsWebFiltersOpen((value) => !value)
              }
              type="button"
            >
              <SlidersHorizontal aria-hidden="true" size={16} />
              Filters
              {(searchMode === "saved" ? savedFilterCount : webFilterCount) >
              0 ? (
                <span>
                  {searchMode === "saved" ? savedFilterCount : webFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          {searchMode === "saved" && areSavedFiltersOpen ? (
            <div
              className="cook-filter-panel"
              aria-label="Saved recipe filters"
            >
              <button
                aria-pressed={favoriteOnly}
                onClick={() => setFavoriteOnly((value) => !value)}
                type="button"
              >
                <Heart aria-hidden="true" size={15} />
                Favorites
              </button>
              <button
                aria-pressed={recentOnly}
                onClick={() => setRecentOnly((value) => !value)}
                type="button"
              >
                <Shuffle aria-hidden="true" size={15} />
                Recent
              </button>
              <label>
                Tag
                <select
                  onChange={(event) => setTagFilter(event.target.value)}
                  value={tagFilter}
                >
                  <option value="all">All</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Rating
                <select
                  onChange={(event) => setMinRating(Number(event.target.value))}
                  value={minRating}
                >
                  <option value={0}>Any</option>
                  <option value={3}>3+</option>
                  <option value={4}>4+</option>
                  <option value={5}>5</option>
                </select>
              </label>
              <label>
                Ingredient
                <select
                  aria-label="Add ingredient filter"
                  onChange={(event) => addIngredientFilter(event.target.value)}
                  value="all"
                >
                  <option value="all">Add</option>
                  {ingredientOptions.map((ingredient) => (
                    <option key={ingredient} value={ingredient}>
                      {ingredient}
                    </option>
                  ))}
                </select>
              </label>
              {selectedIngredients.length > 0 ? (
                <label>
                  Match
                  <select
                    aria-label="Ingredient match threshold"
                    onChange={(event) =>
                      setIngredientThreshold(Number(event.target.value))
                    }
                    value={Math.min(
                      ingredientThreshold,
                      selectedIngredients.length,
                    )}
                  >
                    {selectedIngredients.map((ingredient, index) => (
                      <option key={ingredient} value={index + 1}>
                        {index + 1}+
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {savedFilterCount > 0 ? (
                <button
                  className="cook-clear-filter"
                  onClick={clearSavedFilters}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}

          {searchMode === "saved" && selectedIngredients.length > 0 ? (
            <div
              className="web-selected-ingredients"
              aria-label="Selected ingredient filters"
            >
              {selectedIngredients.map((ingredient) => (
                <button
                  aria-label={`Remove ${ingredient}`}
                  key={ingredient}
                  onClick={() => removeIngredientFilter(ingredient)}
                  type="button"
                >
                  {ingredient}
                  <X aria-hidden="true" size={14} />
                </button>
              ))}
            </div>
          ) : null}

          {searchMode === "web" && isWebFiltersOpen ? (
            <div
              className="cook-filter-panel cook-web-filter-panel"
              aria-label="Web recipe filters"
            >
              <label>
                Category
                <select
                  onChange={(event) => setWebCategory(event.target.value)}
                  value={webCategory}
                >
                  <option value="all">All</option>
                  {webOptions.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Area
                <select
                  onChange={(event) => setWebArea(event.target.value)}
                  value={webArea}
                >
                  <option value="all">All</option>
                  {webOptions.areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ingredient
                <select
                  onChange={(event) => setWebIngredient(event.target.value)}
                  value={webIngredient}
                >
                  <option value="all">All</option>
                  {webOptions.ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.label}
                    </option>
                  ))}
                </select>
              </label>
              {webFilterCount > 0 ? (
                <button
                  className="cook-clear-filter"
                  onClick={() => {
                    setWebCategory("all");
                    setWebArea("all");
                    setWebIngredient("all");
                  }}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}

          {searchMode === "saved" ? (
            <div className="cook-result-list">
              {hasSavedResults ? (
                filteredRecipes
                  .slice(0, 12)
                  .map(({ ingredientMatchCount, recipe: savedRecipe }) => (
                    <article className="cook-result-row" key={savedRecipe.id}>
                      {savedRecipe.imageUrl ? (
                        <Image
                          alt=""
                          height={58}
                          src={savedRecipe.imageUrl}
                          unoptimized
                          width={58}
                        />
                      ) : (
                        <div className="cook-result-thumb">
                          <ChefHat aria-hidden="true" size={20} />
                        </div>
                      )}
                      <div className="cook-result-main">
                        <h3>{savedRecipe.title}</h3>
                        <p>{savedRecipe.summary}</p>
                        <div className="cook-result-meta">
                          <span>
                            {savedRecipe.prepMinutes + savedRecipe.cookMinutes}{" "}
                            min
                          </span>
                          <span>
                            <Star
                              aria-hidden="true"
                              fill="currentColor"
                              size={13}
                            />
                            {savedRecipe.rating}
                          </span>
                          {selectedIngredients.length > 0 ? (
                            <span>
                              {ingredientMatchCount}/
                              {selectedIngredients.length} ingredients
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        className="cook-inline-button cook-inline-button-primary"
                        onClick={() =>
                          window.location.assign(
                            `/cook?recipeId=${savedRecipe.id}`,
                          )
                        }
                        type="button"
                      >
                        Cook
                      </button>
                    </article>
                  ))
              ) : (
                <div className="web-empty-state">
                  <Filter aria-hidden="true" size={28} />
                  <h3>No saved recipes found</h3>
                  <p>
                    Try a different search, clear filters, or add a recipe to
                    your library.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="cook-result-list">
              {webResults.length > 0 ? (
                webResults.map((webRecipe) => (
                  <article className="cook-result-row" key={webRecipe.id}>
                    {webRecipe.thumbnailUrl ? (
                      <Image
                        alt=""
                        height={58}
                        src={webRecipe.thumbnailUrl}
                        unoptimized
                        width={58}
                      />
                    ) : (
                      <div className="cook-result-thumb">
                        <Globe2 aria-hidden="true" size={20} />
                      </div>
                    )}
                    <div className="cook-result-main">
                      <h3>{webRecipe.title}</h3>
                      <p>
                        {[webRecipe.area, webRecipe.category]
                          .filter(Boolean)
                          .join(" · ") || "Web recipe"}
                      </p>
                      <div className="web-tag-row">
                        {webRecipe.tags.slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      className="cook-inline-button cook-inline-button-primary"
                      onClick={() => void cookWebRecipe(webRecipe.id)}
                      type="button"
                    >
                      Cook
                    </button>
                  </article>
                ))
              ) : (
                <div className="web-empty-state">
                  <Globe2 aria-hidden="true" size={28} />
                  <h3>Search web recipes</h3>
                  <p>
                    Enter a recipe idea, or open filters and search by category,
                    area, or ingredient.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
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
      [stepId]: current[stepId] ?? minutes * 60,
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
      wasDragged: false,
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

    const response = await fetch(`/api/recipes/${recipeId}/cooked`, {
      method: "POST",
    });
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
          <button
            aria-label="Decrease servings"
            onClick={() => adjustServings(-1)}
            type="button"
          >
            <Minus aria-hidden="true" size={16} />
          </button>
          <strong>{servings}</strong>
          <button
            aria-label="Increase servings"
            onClick={() => adjustServings(1)}
            type="button"
          >
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
                  checked
                    ? "cook-ingredient cook-ingredient-checked"
                    : "cook-ingredient"
                }
                data-testid={`cook-ingredient-${ingredient.id}`}
                key={ingredient.id}
                onClick={() => toggleIngredient(ingredient.id)}
                type="button"
              >
                <span>
                  {checked ? <Check aria-hidden="true" size={18} /> : null}
                </span>
                <strong>
                  {formatQuantity(ingredient.quantity, scale)}
                  {ingredient.unit ? ` ${ingredient.unit}` : ""}{" "}
                  {ingredient.name}
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
            <h3>
              {activeStep?.timerMinutes
                ? `${activeStep.timerMinutes} min timer`
                : "No timer"}
            </h3>
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
                  onClick={() =>
                    startTimer(activeStep.id, activeStep.timerMinutes!)
                  }
                  type="button"
                >
                  Start
                </Button>
              )}
              <button
                aria-label="Reset timer"
                className="icon-toggle"
                onClick={() =>
                  resetTimer(activeStep.id, activeStep.timerMinutes!)
                }
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
            onClick={() =>
              setActiveStepIndex((index) => Math.max(0, index - 1))
            }
            type="button"
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" size={18} />
            Back
          </Button>
          <Button
            disabled={activeStepIndex === recipe.steps.length - 1}
            onClick={() =>
              setActiveStepIndex((index) =>
                Math.min(recipe.steps.length - 1, index + 1),
              )
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

      <Button
        className="full-width cook-complete-button"
        onClick={markCooked}
        type="button"
      >
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
                : COMPACT_TIMER_SIZE,
          }}
          tabIndex={0}
        >
          {floatingTimerMode === "compact" ? (
            <div className="floating-timer-circle">
              <svg aria-hidden="true" viewBox="0 0 80 80">
                <circle
                  className="floating-timer-track"
                  cx="40"
                  cy="40"
                  r="34"
                />
                <circle
                  className="floating-timer-progress"
                  cx="40"
                  cy="40"
                  r="34"
                  style={{
                    strokeDashoffset: 213.63 * (1 - floatingTimerProgress),
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
                <span
                  style={{
                    width: `${Math.max(0, Math.min(100, floatingTimerProgress * 100))}%`,
                  }}
                />
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

export { AI_DRAFT_STORAGE_KEY, WEB_DRAFT_STORAGE_KEY };
