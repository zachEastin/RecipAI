"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { MEAL_SLOTS, type MealSlot, type Recipe } from "@recipai/recipes";

import { Button } from "../ui";

type EditorState = {
  title: string;
  summary: string;
  source: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  mealSlots: Record<MealSlot, boolean>;
  tags: string;
  ingredients: string;
  steps: string;
};

export type RecipeEditorDraft = {
  title: string;
  summary: string;
  source: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  mealSlots?: MealSlot[];
  tags: string[];
  ingredients: string[];
  steps: string[];
  provenance?: Recipe["provenance"];
};

function stateFromRecipe(
  recipe?: Recipe,
  initialSource = "",
  initialDraft?: RecipeEditorDraft,
): EditorState {
  return {
    title: recipe?.title ?? initialDraft?.title ?? "",
    summary: recipe?.summary ?? initialDraft?.summary ?? "",
    source: recipe?.source ?? initialDraft?.source ?? initialSource,
    servings: String(recipe?.servings ?? initialDraft?.servings ?? 4),
    prepMinutes: String(recipe?.prepMinutes ?? initialDraft?.prepMinutes ?? 10),
    cookMinutes: String(recipe?.cookMinutes ?? initialDraft?.cookMinutes ?? 20),
    mealSlots: Object.fromEntries(
      MEAL_SLOTS.map((slot) => [
        slot,
        (recipe?.mealSlots ?? initialDraft?.mealSlots ?? ["dinner"]).includes(slot)
      ]),
    ) as Record<MealSlot, boolean>,
    tags: recipe?.tags.join(", ") ?? initialDraft?.tags.join(", ") ?? "",
    ingredients:
      recipe?.ingredients
        .map((item) =>
          [item.quantity ?? "", item.unit ?? "", item.name, item.note ? `(${item.note})` : ""]
            .filter(Boolean)
            .join(" "),
        )
        .join("\n") ?? initialDraft?.ingredients.join("\n") ?? "",
    steps: recipe?.steps.map((step) => step.body).join("\n") ?? initialDraft?.steps.join("\n") ?? ""
  };
}

function parseIngredient(line: string) {
  const parts = line.trim().split(/\s+/);
  const first = Number(parts[0]);
  const hasQuantity = Number.isFinite(first);

  return {
    quantity: hasQuantity ? first : null,
    unit: hasQuantity && parts[1] ? parts[1] : null,
    name: (hasQuantity ? parts.slice(2) : parts).join(" "),
    note: null,
    groceryCategory: "Other"
  };
}

export function RecipeEditor({
  initialDraft,
  recipe,
  initialSource = ""
}: {
  initialDraft?: RecipeEditorDraft;
  recipe?: Recipe;
  initialSource?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(() => stateFromRecipe(recipe, initialSource, initialDraft));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function update(key: keyof EditorState, value: string) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateMealSlot(mealSlot: MealSlot, checked: boolean) {
    setState((current) => ({
      ...current,
      mealSlots: { ...current.mealSlots, [mealSlot]: checked }
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const payload = {
      id: recipe?.id,
      title: state.title,
      summary: state.summary,
      source: state.source || null,
      servings: Number(state.servings),
      prepMinutes: Number(state.prepMinutes),
      cookMinutes: Number(state.cookMinutes),
      mealSlots: MEAL_SLOTS.filter((slot) => state.mealSlots[slot]),
      rating: recipe?.rating ?? 0,
      tags: state.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      favorite: recipe?.favorite ?? false,
      provenance: recipe?.provenance ?? initialDraft?.provenance ?? "manual",
      ingredients: state.ingredients
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseIngredient),
      steps: state.steps
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((body) => ({ body, timerMinutes: null }))
    };

    try {
      const response = await fetch(recipe ? `/api/recipes/${recipe.id}` : "/api/recipes", {
        method: recipe ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as { recipe?: Recipe; error?: string };

      if (!response.ok || !body.recipe) {
        throw new Error(body.error ?? "Recipe could not be saved.");
      }

      router.push(`/library/${body.recipe.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recipe could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="editor-form" onSubmit={submit}>
      {error ? (
        <div className="error-panel">
          <strong>Save failed</strong>
          <p>{error}</p>
        </div>
      ) : null}
      <label>
        Title
        <input value={state.title} onChange={(event) => update("title", event.target.value)} />
      </label>
      <label>
        Summary
        <textarea
          rows={3}
          value={state.summary}
          onChange={(event) => update("summary", event.target.value)}
        />
      </label>
      <label>
        Source
        <input value={state.source} onChange={(event) => update("source", event.target.value)} />
      </label>
      <div className="form-grid">
        <label>
          Servings
          <input
            inputMode="numeric"
            value={state.servings}
            onChange={(event) => update("servings", event.target.value)}
          />
        </label>
        <label>
          Prep
          <input
            inputMode="numeric"
            value={state.prepMinutes}
            onChange={(event) => update("prepMinutes", event.target.value)}
          />
        </label>
        <label>
          Cook
          <input
            inputMode="numeric"
            value={state.cookMinutes}
            onChange={(event) => update("cookMinutes", event.target.value)}
          />
        </label>
      </div>
      <fieldset className="meal-slot-fieldset">
        <legend>Meal type</legend>
        <div className="slot-checklist">
          {MEAL_SLOTS.map((slot) => (
            <label key={slot}>
              <span>{slot[0]!.toUpperCase() + slot.slice(1)}</span>
              <input
                checked={state.mealSlots[slot]}
                onChange={(event) => updateMealSlot(slot, event.target.checked)}
                type="checkbox"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Tags
        <input value={state.tags} onChange={(event) => update("tags", event.target.value)} />
      </label>
      <label>
        Ingredients
        <textarea
          rows={7}
          value={state.ingredients}
          onChange={(event) => update("ingredients", event.target.value)}
        />
      </label>
      <label>
        Steps
        <textarea
          rows={7}
          value={state.steps}
          onChange={(event) => update("steps", event.target.value)}
        />
      </label>
      <Button className="full-width" disabled={isSaving} type="submit">
        {isSaving ? "Saving..." : "Save recipe"}
      </Button>
    </form>
  );
}
