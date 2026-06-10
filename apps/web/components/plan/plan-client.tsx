"use client";

import {
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Dice5,
  Lock,
  LockOpen,
  Search,
  Sparkles,
  ShoppingBasket,
  Trash2,
  Utensils,
  X
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type PointerEvent } from "react";

import type { Recipe } from "@recipai/recipes";
import type { ShoppingList, ShoppingListCoverage } from "@recipai/db";

import { Button } from "../ui";

type MealSlot = "breakfast" | "lunch" | "dinner";

type PlanEntry = {
  date: string;
  mealSlot: MealSlot;
  recipeId: string;
  locked: boolean;
};

type SavedPlanEntry = {
  date: string;
  mealSlot: MealSlot;
  recipeId: string | null;
  recipe: Recipe | null;
  locked: boolean;
};

type PlanTarget = {
  date: string;
  mealSlot: MealSlot;
};

type GenerateResponse = {
  assignments?: PlanEntry[];
  recipes?: Recipe[];
  error?: string;
};

type DaySelectionDrag = {
  isDragging: boolean;
  lastDate: string;
  mode: "add" | "remove";
  pointerId: number;
};

type SaveResponse = {
  entries?: SavedPlanEntry[];
  error?: string;
};

type ShoppingListResponse = {
  list?: ShoppingList;
  activeList?: ShoppingList | null;
  coverage?: ShoppingListCoverage;
  error?: string;
};

type ShoppingListPrompt = {
  activeList: ShoppingList;
  coverage: ShoppingListCoverage;
};

const MEAL_SLOTS: Array<{ key: MealSlot; label: string }> = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" }
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function entryKey(date: string, mealSlot: MealSlot): string {
  return `${date}::${mealSlot}`;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromIso(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateRangeInclusive(startDate: string, endDate: string): string[] {
  const start = dateFromIso(startDate);
  const end = dateFromIso(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(toIsoDate(cursor));
  }

  return dates;
}

function sortedDates(dates: Iterable<string>): string[] {
  return Array.from(dates).sort((a, b) => a.localeCompare(b));
}

function describeSelectedDates(dates: string[]): string {
  if (dates.length === 0) {
    return "";
  }

  if (dates.length === 1) {
    return formatDate(dates[0]!);
  }

  return `${formatDate(dates[0]!)} - ${formatDate(dates.at(-1)!)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(dateFromIso(value));
}

function formatMonth(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(value);
}

function searchableRecipeText(recipe: Recipe): string {
  return [
    recipe.title,
    recipe.summary,
    recipe.tags.join(" "),
    recipe.ingredients.map((ingredient) => ingredient.name).join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

function fuzzyScore(recipe: Recipe, query: string): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return recipe.favorite ? 2 : 1;
  }

  const haystack = searchableRecipeText(recipe);
  if (haystack.includes(normalized)) {
    return 100 - haystack.indexOf(normalized);
  }

  let score = 0;
  let cursor = 0;
  for (const char of normalized) {
    const index = haystack.indexOf(char, cursor);
    if (index === -1) {
      return -1;
    }

    score += Math.max(1, 12 - (index - cursor));
    cursor = index + 1;
  }

  return score;
}

export function PlanClient({
  startDate,
  endDate,
  initialEntries,
  recipes
}: {
  startDate: string;
  endDate: string;
  initialEntries: SavedPlanEntry[];
  recipes: Recipe[];
}) {
  const today = toIsoDate(new Date());
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const date = dateFromIso(startDate);
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  });
  const [entries, setEntries] = useState<PlanEntry[]>(
    initialEntries
      .filter((entry) => entry.recipeId)
      .map((entry) => ({
        date: entry.date,
        mealSlot: entry.mealSlot,
        recipeId: entry.recipeId!,
        locked: entry.locked
      })),
  );
  const [recipeList, setRecipeList] = useState(recipes);
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [shoppingListPrompt, setShoppingListPrompt] = useState<ShoppingListPrompt | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PlanTarget | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generateRange, setGenerateRange] = useState({ startDate, endDate });
  const [generateSelectedDates, setGenerateSelectedDates] = useState<string[] | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Record<MealSlot, boolean>>({
    breakfast: true,
    lunch: true,
    dinner: true
  });
  const [preserveLocked, setPreserveLocked] = useState(true);
  const [fillEmptyOnly, setFillEmptyOnly] = useState(false);
  const [avoidRepeats, setAvoidRepeats] = useState(true);
  const [avoidRecentMeals, setAvoidRecentMeals] = useState(true);
  const [preferQuickWeekdays, setPreferQuickWeekdays] = useState(true);
  const [addVariety, setAddVariety] = useState(true);
  const daySelectionDrag = useRef<DaySelectionDrag | null>(null);

  const recipeById = useMemo(
    () => new Map(recipeList.map((recipe) => [recipe.id, recipe])),
    [recipeList],
  );
  const entryByKey = useMemo(
    () => new Map(entries.map((entry) => [entryKey(entry.date, entry.mealSlot), entry])),
    [entries],
  );
  const pickerEntry = pickerTarget
    ? entryByKey.get(entryKey(pickerTarget.date, pickerTarget.mealSlot)) ?? null
    : null;
  const pickerRecipe = pickerEntry ? recipeById.get(pickerEntry.recipeId) ?? null : null;
  const hasRecipeForSlot = useMemo(
    () =>
      Object.fromEntries(
        MEAL_SLOTS.map((slot) => [
          slot.key,
          recipeList.some((recipe) => isRecipeEligibleForSlot(recipe, slot.key))
        ]),
      ) as Record<MealSlot, boolean>,
    [recipeList],
  );
  const pickerRecipes = useMemo(() => {
    return recipeList
      .map((recipe) => ({ recipe, score: fuzzyScore(recipe, pickerQuery) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if (a.recipe.rating !== b.recipe.rating) {
          return b.recipe.rating - a.recipe.rating;
        }

        return a.recipe.title.localeCompare(b.recipe.title);
      })
      .map((item) => item.recipe);
  }, [pickerQuery, recipeList]);

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1, 12);
    const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index);
      return {
        date,
        iso: toIsoDate(date),
        isCurrentMonth: date.getMonth() === monthAnchor.getMonth()
      };
    });
  }, [monthAnchor]);
  const selectedDateSet = useMemo(() => new Set(selectedDates), [selectedDates]);
  const generationDates = dateRangeInclusive(generateRange.startDate, generateRange.endDate);
  const activeGenerationDates = generateSelectedDates ?? generationDates;
  const generationSlots = MEAL_SLOTS.filter(
    (slot) => selectedSlots[slot.key] && hasRecipeForSlot[slot.key],
  ).map(
    (slot) => slot.key,
  );
  const generationSlotCount = activeGenerationDates.length * generationSlots.length;
  const selectedGenerationSlotCount = selectedDates.length * generationSlots.length;

  function selectedEntry(mealSlot: MealSlot): PlanEntry | null {
    if (!selectedDate) {
      return null;
    }

    return entryByKey.get(entryKey(selectedDate, mealSlot)) ?? null;
  }

  function mergeGenerated(assignments: PlanEntry[]) {
    setEntries(assignments);
  }

  async function generate({
    mealSlots,
    rerollTargets,
    dates,
    range,
    closeModal = false
  }: {
    mealSlots: MealSlot[];
    rerollTargets?: PlanTarget[];
    dates?: string[];
    range?: { startDate: string; endDate: string };
    closeModal?: boolean;
  }) {
    if (mealSlots.length === 0) {
      setStatus("Choose at least one meal slot.");
      return;
    }

    setIsBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/meal-plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates,
          startDate: range?.startDate,
          endDate: range?.endDate,
          mealSlots,
          existingAssignments: entries,
          rerollTargets,
          preserveLocked,
          fillEmptyOnly,
          avoidRepeats,
          avoidRecentMeals,
          preferQuickWeekdays,
          addVariety
        })
      });
      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok || !payload.assignments || !payload.recipes) {
        throw new Error(payload.error ?? "Could not generate a meal plan.");
      }

      mergeGenerated(payload.assignments);
      setRecipeList(payload.recipes);
      setStatus("Generated a meal plan. Save it when it looks right.");
      if (closeModal) {
        setIsGenerateOpen(false);
      }
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not generate a meal plan.");
    } finally {
      setIsBusy(false);
    }
  }

  async function save() {
    setIsBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries })
      });
      const payload = (await response.json()) as SaveResponse;

      if (!response.ok || !payload.entries) {
        throw new Error(payload.error ?? "Could not save the meal plan.");
      }

      setEntries(
        payload.entries
          .filter((entry) => entry.recipeId)
          .map((entry) => ({
            date: entry.date,
            mealSlot: entry.mealSlot,
            recipeId: entry.recipeId!,
            locked: entry.locked
          })),
      );
      setStatus("Meal plan saved.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not save the meal plan.");
    } finally {
      setIsBusy(false);
    }
  }

  async function clearRange() {
    setIsBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/meal-plans/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generateRange)
      });

      if (!response.ok) {
        throw new Error("Could not clear this date range.");
      }

      const clearDates = new Set(generationDates);
      setEntries((current) => current.filter((entry) => !clearDates.has(entry.date)));
      setStatus("Cleared the selected range.");
      setIsGenerateOpen(false);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not clear this date range.");
    } finally {
      setIsBusy(false);
    }
  }

  async function clearSlot(date: string, mealSlot: MealSlot) {
    setIsBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/meal-plans/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mealSlot })
      });

      if (!response.ok) {
        throw new Error("Could not clear this meal.");
      }

      setEntries((current) =>
        current.filter((entry) => entry.date !== date || entry.mealSlot !== mealSlot),
      );
      setStatus(`${slotLabel(mealSlot)} cleared for ${formatDate(date)}.`);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not clear this meal.");
    } finally {
      setIsBusy(false);
    }
  }

  function slotLabel(mealSlot: MealSlot): string {
    return MEAL_SLOTS.find((slot) => slot.key === mealSlot)?.label ?? mealSlot;
  }

  function isRecipeEligibleForSlot(recipe: Recipe, mealSlot: MealSlot): boolean {
    return recipe.mealSlots.includes(mealSlot);
  }

  function toggleLock(date: string, mealSlot: MealSlot) {
    setEntries((current) =>
      current.map((entry) =>
        entry.date === date && entry.mealSlot === mealSlot
          ? { ...entry, locked: !entry.locked }
          : entry,
      ),
    );
  }

  function openPicker(target: PlanTarget) {
    setPickerTarget(target);
    setPickerQuery("");
  }

  function closePicker() {
    setPickerTarget(null);
    setPickerQuery("");
  }

  function pickRecipe(target: PlanTarget, recipe: Recipe) {
    const key = entryKey(target.date, target.mealSlot);
    setEntries((current) => {
      const nextEntry = {
        date: target.date,
        mealSlot: target.mealSlot,
        recipeId: recipe.id,
        locked: true
      };
      const hasEntry = current.some((entry) => entryKey(entry.date, entry.mealSlot) === key);

      return hasEntry
        ? current.map((entry) => (entryKey(entry.date, entry.mealSlot) === key ? nextEntry : entry))
        : [...current, nextEntry].sort((a, b) =>
            a.date === b.date
              ? MEAL_SLOTS.findIndex((slot) => slot.key === a.mealSlot) -
                MEAL_SLOTS.findIndex((slot) => slot.key === b.mealSlot)
              : a.date.localeCompare(b.date),
          );
    });
    setStatus(`${recipe.title} picked for ${slotLabel(target.mealSlot).toLowerCase()}.`);
    closePicker();
  }

  function moveMonth(delta: number) {
    setMonthAnchor(
      (current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12),
    );
  }

  function jumpToToday() {
    const date = dateFromIso(today);
    setMonthAnchor(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    setSelectedDates([today]);
  }

  function applyDaySelection(date: string, mode: DaySelectionDrag["mode"]) {
    setSelectedDates((current) => {
      const next = new Set(current);

      if (mode === "add") {
        next.add(date);
      } else {
        next.delete(date);
      }

      return sortedDates(next);
    });
  }

  function toggleDaySelection(date: string) {
    setSelectedDates((current) => {
      const next = new Set(current);

      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }

      return sortedDates(next);
    });
  }

  function dateFromPointer(event: PointerEvent): string | null {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    return element?.closest<HTMLElement>("[data-plan-date]")?.dataset.planDate ?? null;
  }

  function beginDaySelection(date: string, event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const mode = selectedDateSet.has(date) ? "remove" : "add";
    daySelectionDrag.current = {
      isDragging: false,
      lastDate: date,
      mode,
      pointerId: event.pointerId
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    applyDaySelection(date, mode);
  }

  function continueDaySelection(event: PointerEvent<HTMLDivElement>) {
    const drag = daySelectionDrag.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const date = dateFromPointer(event);
    if (!date || date === drag.lastDate) {
      return;
    }

    drag.lastDate = date;
    drag.isDragging = true;
    applyDaySelection(date, drag.mode);
  }

  function endDaySelection(event: PointerEvent) {
    const drag = daySelectionDrag.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    daySelectionDrag.current = null;
  }

  function openSelectedMeals() {
    if (selectedDates.length === 1) {
      setSelectedDate(selectedDates[0]!);
    }
  }

  function openGenerateForSelectedDates() {
    if (selectedDates.length === 0) {
      return;
    }

    setGenerateSelectedDates(selectedDates);
    setGenerateRange({
      startDate: selectedDates[0]!,
      endDate: selectedDates.at(-1)!
    });
    setIsGenerateOpen(true);
  }

  async function postSelectedShoppingList(mode: "preview" | "create" | "override" | "add-missing") {
    const response = await fetch("/api/shopping-lists/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates: selectedDates, mode })
    });
    const payload = (await response.json()) as ShoppingListResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "Could not create a shopping list.");
    }

    return payload;
  }

  async function createShoppingListFromSelectedDays() {
    if (selectedDates.length === 0) {
      return;
    }

    setIsBusy(true);
    setStatus(null);

    try {
      const preview = await postSelectedShoppingList("preview");

      if (preview.activeList && preview.coverage) {
        setShoppingListPrompt({
          activeList: preview.activeList,
          coverage: preview.coverage
        });
        return;
      }

      const created = await postSelectedShoppingList("create");
      if (!created.list) {
        throw new Error("Could not create a shopping list.");
      }

      setStatus(
        created.list.items.length > 0
          ? "Created a shopping list from the selected days."
          : "Created an empty shopping list. Add planned meals, then create it again.",
      );
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not create a shopping list.");
    } finally {
      setIsBusy(false);
    }
  }

  async function resolveShoppingListPrompt(mode: "override" | "add-missing") {
    setIsBusy(true);
    setStatus(null);

    try {
      const payload = await postSelectedShoppingList(mode);

      if (!payload.list) {
        throw new Error("Could not update the shopping list.");
      }

      setShoppingListPrompt(null);
      if (mode === "override") {
        setStatus("Replaced the active shopping list with selected-day ingredients.");
      } else {
        const addedCount = payload.coverage?.missingItems.length ?? 0;
        setStatus(
          addedCount > 0
            ? `Added ${addedCount} missing ${addedCount === 1 ? "item" : "items"} to the active shopping list.`
            : "Selected-day ingredients are already on the active shopping list.",
        );
      }
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not update the shopping list.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="screen-stack plan-screen">
      <section className="plan-calendar-panel">
        <div className="plan-calendar-toolbar">
          <button
            aria-label="Previous month"
            className="icon-toggle"
            onClick={() => moveMonth(-1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <div>
            <h2>{formatMonth(monthAnchor)}</h2>
            <p>{entries.length} planned meals</p>
          </div>
          <button
            aria-label="Next month"
            className="icon-toggle"
            onClick={() => moveMonth(1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="plan-top-actions">
          <Button
            onClick={() => {
              setGenerateSelectedDates(null);
              setIsGenerateOpen(true);
            }}
          >
            <Sparkles aria-hidden="true" size={17} />
            Generate
          </Button>
          <Button disabled={isBusy || entries.length === 0} onClick={() => void save()} variant="secondary">
            Save plan
          </Button>
          <button className="plan-today-button" onClick={jumpToToday} type="button">
            Today
          </button>
        </div>

        <div className="meal-slot-legend" aria-label="Meal slot legend">
          {MEAL_SLOTS.map((slot) => (
            <span key={slot.key}>
              <i className={`meal-bar meal-bar-${slot.key}`} />
              {slot.label}
            </span>
          ))}
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div
          className="meal-calendar-grid"
          onPointerCancel={endDaySelection}
          onPointerMove={continueDaySelection}
          onPointerUp={endDaySelection}
        >
          {calendarDays.map((day) => {
            const dayEntries = MEAL_SLOTS.map((slot) => ({
              slot: slot.key,
              entry: entryByKey.get(entryKey(day.iso, slot.key)) ?? null
            }));
            const isSelected = selectedDateSet.has(day.iso);
            const isDayPlanOpen = selectedDate === day.iso;
            const hasMeal = dayEntries.some((item) => item.entry);

            return (
              <button
                aria-label={`${formatDate(day.iso)}${hasMeal ? ", meals planned" : ", no meals planned"}`}
                aria-pressed={isSelected}
                className={[
                  "meal-calendar-day",
                  day.isCurrentMonth ? "" : "meal-calendar-day-muted",
                  day.iso === today ? "meal-calendar-day-today" : "",
                  isSelected ? "meal-calendar-day-batch-selected" : "",
                  isDayPlanOpen ? "meal-calendar-day-selected" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-plan-date={day.iso}
                key={day.iso}
                onClick={(event) => {
                  if (event.detail === 0) {
                    toggleDaySelection(day.iso);
                  }
                }}
                onPointerDown={(event) => beginDaySelection(day.iso, event)}
                type="button"
              >
                <span>{day.date.getDate()}</span>
                <div className="meal-day-bars">
                  {dayEntries.map((item) => (
                    <i
                      className={
                        item.entry
                          ? `meal-bar meal-bar-${item.slot}`
                          : "meal-bar meal-bar-empty"
                      }
                      key={item.slot}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        {selectedDates.length > 0 ? (
          <div className="plan-selection-bar" role="region" aria-label="Selected planning days">
            <div>
              <strong>
                {selectedDates.length} {selectedDates.length === 1 ? "day" : "days"} selected
              </strong>
              <span>{describeSelectedDates(selectedDates)}</span>
            </div>
            <div className="plan-selection-actions">
              {selectedDates.length === 1 ? (
                <button className="pick-recipe-button" onClick={openSelectedMeals} type="button">
                  Meals
                </button>
              ) : null}
              <Button
                disabled={isBusy || recipeList.length === 0 || selectedGenerationSlotCount === 0}
                onClick={openGenerateForSelectedDates}
              >
                <Sparkles aria-hidden="true" size={17} />
                Generate
              </Button>
              <Button
                disabled={isBusy}
                onClick={() => void createShoppingListFromSelectedDays()}
                variant="secondary"
              >
                <ShoppingBasket aria-hidden="true" size={17} />
                Create list
              </Button>
              <button
                className="plan-today-button"
                onClick={() => setSelectedDates([])}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
        {status ? <p className="status-text">{status}</p> : null}
      </section>

      {shoppingListPrompt ? (
        <div
          className="recipe-picker-backdrop shopping-list-backdrop"
          role="presentation"
          onClick={() => setShoppingListPrompt(null)}
        >
          <section
            aria-labelledby="shopping-list-conflict-title"
            aria-modal="true"
            className="shopping-list-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="recipe-picker-header">
              <div>
                <p className="plan-date">
                  {shoppingListPrompt.coverage.representedItems} of{" "}
                  {shoppingListPrompt.coverage.totalItems} represented
                </p>
                <h2 id="shopping-list-conflict-title">Update shopping list?</h2>
                <p>A shopping list is already active.</p>
              </div>
              <button
                aria-label="Close shopping list options"
                className="icon-toggle"
                onClick={() => setShoppingListPrompt(null)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="shopping-list-coverage">
              <ShoppingBasket aria-hidden="true" size={18} />
              <span>
                {shoppingListPrompt.coverage.totalItems === 0
                  ? "No selected-day ingredients to add."
                  : shoppingListPrompt.coverage.missingItems.length === 0
                  ? "Selected ingredients are already covered."
                  : `${shoppingListPrompt.coverage.missingItems.length} missing ${
                      shoppingListPrompt.coverage.missingItems.length === 1 ? "item" : "items"
                    } can be added.`}
              </span>
            </div>

            <div className="plan-action-grid">
              <Button
                disabled={isBusy}
                onClick={() => void resolveShoppingListPrompt("override")}
                type="button"
              >
                Override list
              </Button>
              <Button
                disabled={isBusy || shoppingListPrompt.coverage.missingItems.length === 0}
                onClick={() => void resolveShoppingListPrompt("add-missing")}
                type="button"
                variant="secondary"
              >
                Add missing items
              </Button>
            </div>
            <button
              className="plan-today-button"
              onClick={() => setShoppingListPrompt(null)}
              type="button"
            >
              Cancel
            </button>
          </section>
        </div>
      ) : null}

      {selectedDate ? (
        <div
          className="recipe-picker-backdrop day-plan-backdrop"
          role="presentation"
          onClick={() => setSelectedDate(null)}
        >
          <section
            aria-labelledby="day-plan-title"
            className="day-plan-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="recipe-picker-header">
              <div>
                <p className="plan-date">{formatDate(selectedDate)}</p>
                <h2 id="day-plan-title">Meals</h2>
              </div>
              <button
                className="icon-toggle"
                onClick={() => setSelectedDate(null)}
                type="button"
                aria-label="Close day plan"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="day-meal-list">
              {MEAL_SLOTS.map((slot) => {
                const entry = selectedEntry(slot.key);
                const recipe = entry ? recipeById.get(entry.recipeId) ?? null : null;
                const isLocked = entry?.locked ?? false;

                return (
                  <article className="day-meal-row" key={slot.key}>
                    <div className="day-meal-main">
                      <span className={`meal-slot-marker meal-bar-${slot.key}`} />
                      <div>
                        <p>{slot.label}</p>
                        <h3>{recipe?.title ?? "Not planned"}</h3>
                        {recipe ? (
                          <span>
                            {recipe.prepMinutes + recipe.cookMinutes} min · {recipe.servings} servings
                          </span>
                        ) : (
                          <span>Pick manually or roll a saved recipe.</span>
                        )}
                      </div>
                    </div>
                    <div className="day-meal-actions">
                      <button
                        aria-label={isLocked ? `Unlock ${slot.label}` : `Lock ${slot.label}`}
                        className={isLocked ? "icon-toggle icon-toggle-active" : "icon-toggle"}
                        disabled={!entry}
                        onClick={() => toggleLock(selectedDate, slot.key)}
                        type="button"
                      >
                        {isLocked ? (
                          <Lock aria-hidden="true" size={17} />
                        ) : (
                          <LockOpen aria-hidden="true" size={17} />
                        )}
                      </button>
                      <button
                        aria-label={`Random ${slot.label}`}
                        className="icon-toggle"
                        disabled={isBusy || isLocked || recipeList.length === 0}
                        onClick={() =>
                          void generate({
                            mealSlots: [slot.key],
                            rerollTargets: [{ date: selectedDate, mealSlot: slot.key }],
                            dates: [selectedDate]
                          })
                        }
                        type="button"
                      >
                        <Dice5 aria-hidden="true" size={17} />
                      </button>
                      <button
                        className="pick-recipe-button"
                        onClick={() => openPicker({ date: selectedDate, mealSlot: slot.key })}
                        type="button"
                      >
                        Pick
                      </button>
                      <button
                        aria-label={`Clear ${slot.label}`}
                        className="icon-toggle"
                        disabled={isBusy || !entry}
                        onClick={() => void clearSlot(selectedDate, slot.key)}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                      {recipe ? (
                        <Link className="cook-link" href={`/cook?recipeId=${recipe.id}`}>
                          <Utensils aria-hidden="true" size={16} />
                          Cook
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {isGenerateOpen ? (
        <div
          className="recipe-picker-backdrop generate-plan-backdrop"
          role="presentation"
          onClick={() => setIsGenerateOpen(false)}
        >
          <section
            aria-labelledby="generate-plan-title"
            className="generate-plan-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="recipe-picker-header">
              <div>
                <p className="plan-date">{activeGenerationDates.length || 0} days</p>
                <h2 id="generate-plan-title">Generate plan</h2>
              </div>
              <button
                className="icon-toggle"
                onClick={() => setIsGenerateOpen(false)}
                type="button"
                aria-label="Close generator"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="date-range-grid">
              <label>
                Start
                <input
                  type="date"
                  value={generateRange.startDate}
                  onChange={(event) => {
                    setGenerateSelectedDates(null);
                    setGenerateRange((current) => ({
                      ...current,
                      startDate: event.target.value
                    }));
                  }}
                />
              </label>
              <label>
                End
                <input
                  type="date"
                  value={generateRange.endDate}
                  onChange={(event) => {
                    setGenerateSelectedDates(null);
                    setGenerateRange((current) => ({
                      ...current,
                      endDate: event.target.value
                    }));
                  }}
                />
              </label>
            </div>

            <div className="slot-checklist">
              {MEAL_SLOTS.map((slot) => {
                const isAvailable = hasRecipeForSlot[slot.key];

                return (
                  <label
                    className={isAvailable ? "" : "slot-checklist-disabled"}
                    key={slot.key}
                  >
                    <span>
                      <i className={`meal-bar meal-bar-${slot.key}`} />
                      <span>
                        {slot.label}
                        {!isAvailable ? <small>No saved recipes</small> : null}
                      </span>
                    </span>
                    <input
                      checked={isAvailable && selectedSlots[slot.key]}
                      disabled={!isAvailable}
                      onChange={(event) =>
                        setSelectedSlots((current) => ({
                          ...current,
                          [slot.key]: event.target.checked
                        }))
                      }
                      type="checkbox"
                    />
                  </label>
                );
              })}
            </div>

            <div className="generate-options">
              <label>
                <span>Preserve locked meals</span>
                <input
                  checked={preserveLocked}
                  onChange={(event) => setPreserveLocked(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label>
                <span>Fill empty slots only</span>
                <input
                  checked={fillEmptyOnly}
                  onChange={(event) => setFillEmptyOnly(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label>
                <span>Avoid repeats</span>
                <input
                  checked={avoidRepeats}
                  onChange={(event) => setAvoidRepeats(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label>
                <span>Avoid recent meals</span>
                <input
                  checked={avoidRecentMeals}
                  onChange={(event) => setAvoidRecentMeals(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label>
                <span>Prefer quick weekdays</span>
                <input
                  checked={preferQuickWeekdays}
                  onChange={(event) => setPreferQuickWeekdays(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label>
                <span>Add variety</span>
                <input
                  checked={addVariety}
                  onChange={(event) => setAddVariety(event.target.checked)}
                  type="checkbox"
                />
              </label>
            </div>

            <div className="generate-summary">
              <CalendarCheck aria-hidden="true" size={18} />
              <span>
                {activeGenerationDates.length} days, {generationSlotCount} slots
              </span>
            </div>

            <div className="plan-action-grid">
              <Button
                disabled={isBusy || recipeList.length === 0 || generationSlotCount === 0}
                onClick={() =>
                  void generate({
                    mealSlots: generationSlots,
                    ...(generateSelectedDates
                      ? { dates: generateSelectedDates }
                      : { range: generateRange }),
                    closeModal: true
                  })
                }
              >
                <Sparkles aria-hidden="true" size={17} />
                Generate plan
              </Button>
              <Button disabled={isBusy} onClick={() => void clearRange()} variant="secondary">
                <Trash2 aria-hidden="true" size={17} />
                Clear range
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {pickerTarget ? (
        <div className="recipe-picker-backdrop" role="presentation" onClick={closePicker}>
          <section
            aria-labelledby="recipe-picker-title"
            className="recipe-picker-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="recipe-picker-header">
              <div>
                <p className="plan-date">
                  {formatDate(pickerTarget.date)} · {slotLabel(pickerTarget.mealSlot)}
                </p>
                <h2 id="recipe-picker-title">Pick meal</h2>
                <p>{pickerRecipe ? `Currently ${pickerRecipe.title}` : "Choose a saved recipe"}</p>
              </div>
              <button className="icon-toggle" onClick={closePicker} type="button" aria-label="Close picker">
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <label className="picker-search">
              <Search aria-hidden="true" size={18} />
              <input
                autoFocus
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="Search title, tag, ingredient"
                value={pickerQuery}
              />
            </label>
            <div className="recipe-picker-results">
              {pickerRecipes.map((recipe) => {
                const isSelected = recipe.id === pickerEntry?.recipeId;
                const isEligible = isRecipeEligibleForSlot(recipe, pickerTarget.mealSlot);
                return (
                  <button
                    className={[
                      "picker-result",
                      isSelected ? "picker-result-active" : "",
                      isEligible ? "" : "picker-result-warning"
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={recipe.id}
                    onClick={() => pickRecipe(pickerTarget, recipe)}
                    type="button"
                  >
                    <span>
                      <strong>{recipe.title}</strong>
                      <small>
                        {recipe.prepMinutes + recipe.cookMinutes} min · {recipe.servings} servings
                      </small>
                      <em>
                        {isEligible
                          ? recipe.tags.slice(0, 3).join(" · ")
                          : `Not marked for ${slotLabel(pickerTarget.mealSlot).toLowerCase()}`}
                      </em>
                    </span>
                    {isSelected ? <Check aria-hidden="true" size={19} /> : null}
                  </button>
                );
              })}
              {pickerRecipes.length === 0 ? (
                <div className="picker-empty">
                  <strong>No recipes found</strong>
                  <p>Try a title, tag, or ingredient from your saved recipes.</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
