"use client";

import {
  CalendarCheck,
  Check,
  Lock,
  LockOpen,
  RotateCcw,
  Search,
  Trash2,
  Utensils,
  X
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Recipe } from "@recipai/recipes";

import { Button } from "../ui";

type PlanEntry = {
  date: string;
  recipeId: string;
  locked: boolean;
};

type SavedPlanEntry = {
  date: string;
  recipeId: string | null;
  recipe: Recipe | null;
  locked: boolean;
};

type GenerateResponse = {
  assignments?: PlanEntry[];
  recipes?: Recipe[];
  error?: string;
};

type SaveResponse = {
  entries?: SavedPlanEntry[];
  error?: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T12:00:00`));
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
  const [range, setRange] = useState({ startDate, endDate });
  const [entries, setEntries] = useState<PlanEntry[]>(
    initialEntries
      .filter((entry) => entry.recipeId)
      .map((entry) => ({
        date: entry.date,
        recipeId: entry.recipeId!,
        locked: entry.locked
      })),
  );
  const [recipeList, setRecipeList] = useState(recipes);
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");

  const recipeById = useMemo(
    () => new Map(recipeList.map((recipe) => [recipe.id, recipe])),
    [recipeList],
  );
  const pickerEntry = pickerDate
    ? entries.find((entry) => entry.date === pickerDate) ?? null
    : null;
  const pickerRecipe = pickerEntry ? recipeById.get(pickerEntry.recipeId) ?? null : null;
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

  async function generate(rerollDates?: string[]) {
    setIsBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/meal-plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: range.startDate,
          endDate: range.endDate,
          existingAssignments: entries,
          rerollDates
        })
      });
      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok || !payload.assignments || !payload.recipes) {
        throw new Error(payload.error ?? "Could not generate a dinner plan.");
      }

      setEntries(payload.assignments);
      setRecipeList(payload.recipes);
      setStatus("Generated a dinner plan. Save it when it looks right.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not generate a dinner plan.");
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
        throw new Error(payload.error ?? "Could not save the dinner plan.");
      }

      setEntries(
        payload.entries
          .filter((entry) => entry.recipeId)
          .map((entry) => ({
            date: entry.date,
            recipeId: entry.recipeId!,
            locked: entry.locked
          })),
      );
      setStatus("Dinner plan saved.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not save the dinner plan.");
    } finally {
      setIsBusy(false);
    }
  }

  async function clear() {
    setIsBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/meal-plans/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(range)
      });

      if (!response.ok) {
        throw new Error("Could not clear this date range.");
      }

      setEntries([]);
      setStatus("Cleared the selected range.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not clear this date range.");
    } finally {
      setIsBusy(false);
    }
  }

  function toggleLock(date: string) {
    setEntries((current) =>
      current.map((entry) =>
        entry.date === date ? { ...entry, locked: !entry.locked } : entry,
      ),
    );
  }

  function openPicker(date: string) {
    setPickerDate(date);
    setPickerQuery("");
  }

  function closePicker() {
    setPickerDate(null);
    setPickerQuery("");
  }

  function pickRecipe(date: string, recipe: Recipe) {
    setEntries((current) =>
      current.map((entry) =>
        entry.date === date ? { ...entry, recipeId: recipe.id, locked: true } : entry,
      ),
    );
    setStatus(`${recipe.title} picked and locked for ${formatDate(date)}.`);
    closePicker();
  }

  const unlockedDates = entries.filter((entry) => !entry.locked).map((entry) => entry.date);

  return (
    <div className="screen-stack">
      <section className="panel plan-control-panel">
        <div className="icon-title">
          <CalendarCheck aria-hidden="true" size={24} />
          <div>
            <h2>Plan dinners</h2>
            <p>Assign random saved recipes across a date range.</p>
          </div>
        </div>
        <div className="date-range-grid">
          <label>
            Start
            <input
              type="date"
              value={range.startDate}
              onChange={(event) =>
                setRange((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </label>
          <label>
            End
            <input
              type="date"
              value={range.endDate}
              onChange={(event) =>
                setRange((current) => ({ ...current, endDate: event.target.value }))
              }
            />
          </label>
        </div>
        <div className="plan-action-grid">
          <Button disabled={isBusy || recipeList.length === 0} onClick={() => void generate()}>
            <RotateCcw aria-hidden="true" size={18} />
            Generate
          </Button>
          <Button
            disabled={isBusy || unlockedDates.length === 0}
            onClick={() => void generate(unlockedDates)}
            variant="secondary"
          >
            Reroll unlocked
          </Button>
        </div>
        <div className="plan-action-grid">
          <Button disabled={isBusy || entries.length === 0} onClick={() => void save()}>
            Save plan
          </Button>
          <Button disabled={isBusy} onClick={() => void clear()} variant="secondary">
            <Trash2 aria-hidden="true" size={17} />
            Clear
          </Button>
        </div>
        {status ? <p className="status-text">{status}</p> : null}
      </section>

      {entries.length === 0 ? (
        <section className="empty-state">
          <h2>No dinners planned</h2>
          <p>Generate a date range to fill it with saved recipes.</p>
        </section>
      ) : (
        <section className="plan-list">
          {entries.map((entry) => {
            const recipe = recipeById.get(entry.recipeId);
            return (
              <article className="plan-day-card" key={entry.date}>
                <div>
                  <p className="plan-date">{formatDate(entry.date)}</p>
                  <h3>{recipe?.title ?? "Recipe missing"}</h3>
                  {recipe ? (
                    <p>
                      {recipe.prepMinutes + recipe.cookMinutes} min · {recipe.servings} servings
                    </p>
                  ) : null}
                </div>
                <div className="plan-day-actions">
                  <button
                    aria-label={entry.locked ? "Unlock meal" : "Lock meal"}
                    className={entry.locked ? "icon-toggle icon-toggle-active" : "icon-toggle"}
                    onClick={() => toggleLock(entry.date)}
                    type="button"
                  >
                    {entry.locked ? (
                      <Lock aria-hidden="true" size={18} />
                    ) : (
                      <LockOpen aria-hidden="true" size={18} />
                    )}
                  </button>
                  <button
                    className="icon-toggle"
                    disabled={entry.locked || isBusy}
                    onClick={() => void generate([entry.date])}
                    type="button"
                    aria-label="Reroll this dinner"
                  >
                    <RotateCcw aria-hidden="true" size={18} />
                  </button>
                  <button
                    className="pick-recipe-button"
                    onClick={() => openPicker(entry.date)}
                    type="button"
                  >
                    Pick
                  </button>
                  {recipe ? (
                    <Link className="cook-link" href={`/cook?recipeId=${recipe.id}`}>
                      <Utensils aria-hidden="true" size={17} />
                      Cook
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
      {pickerDate && pickerEntry ? (
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
                <p className="plan-date">{formatDate(pickerDate)}</p>
                <h2 id="recipe-picker-title">Pick dinner</h2>
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
                const isSelected = recipe.id === pickerEntry.recipeId;
                return (
                  <button
                    className={isSelected ? "picker-result picker-result-active" : "picker-result"}
                    key={recipe.id}
                    onClick={() => pickRecipe(pickerDate, recipe)}
                    type="button"
                  >
                    <span>
                      <strong>{recipe.title}</strong>
                      <small>
                        {recipe.prepMinutes + recipe.cookMinutes} min · {recipe.servings} servings
                      </small>
                      <em>{recipe.tags.slice(0, 3).join(" · ")}</em>
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
