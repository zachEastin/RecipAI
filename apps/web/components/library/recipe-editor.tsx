"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";

import { MEAL_SLOTS, type MealSlot, type Recipe } from "@recipai/recipes";

import {
  parseIngredientLine,
  parseIngredientQuantityInput,
} from "@/lib/ingredient-parser";

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

type IngredientEditMode = "structured" | "text";

type IngredientRow = {
  id: string;
  quantity: string;
  unit: string;
  name: string;
  note: string;
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

const COMMON_UNITS = [
  "tsp",
  "tbsp",
  "cup",
  "oz",
  "lb",
  "g",
  "kg",
  "ml",
  "l",
  "clove",
  "can",
  "jar",
  "bunch",
  "head",
  "package",
  "packet",
  "slice",
  "stick",
  "sprig",
] as const;

function formatIngredientQuantity(quantity: number | null): string {
  return quantity === null ? "" : String(quantity);
}

function ingredientLineFromRow(row: IngredientRow): string {
  return [row.quantity, row.unit, row.name, row.note ? `(${row.note})` : ""]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function rowFromIngredientLine(line: string, index: number): IngredientRow {
  const parsed = parseIngredientLine(line);

  return {
    id: `ingredient-${index}-${line}`,
    quantity: formatIngredientQuantity(parsed.quantity),
    unit: parsed.unit ?? "",
    name: parsed.name,
    note: parsed.note ?? "",
  };
}

function ingredientRowsFromText(value: string): IngredientRow[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(rowFromIngredientLine);
}

function ingredientTextFromRows(rows: IngredientRow[]): string {
  return rows.map(ingredientLineFromRow).filter(Boolean).join("\n");
}

function saveIngredientFromRow(row: IngredientRow) {
  const parsedQuantity = parseIngredientQuantityInput(row.quantity);

  return {
    quantity: row.quantity.trim() ? parsedQuantity : null,
    unit: row.unit.trim() || null,
    name: row.name.trim(),
    note: row.note.trim() || null,
    groceryCategory: "Other",
  };
}

function EditableIngredientCell({
  ariaLabel,
  onChange,
  placeholder,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="ingredient-cell-text"
      contentEditable
      data-placeholder={placeholder}
      onInput={(event) => onChange(event.currentTarget.textContent ?? "")}
      role="textbox"
      suppressContentEditableWarning
    >
      {value}
    </div>
  );
}

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
        (recipe?.mealSlots ?? initialDraft?.mealSlots ?? ["dinner"]).includes(
          slot,
        ),
      ]),
    ) as Record<MealSlot, boolean>,
    tags: recipe?.tags.join(", ") ?? initialDraft?.tags.join(", ") ?? "",
    ingredients:
      recipe?.ingredients
        .map((item) =>
          [
            item.quantity ?? "",
            item.unit ?? "",
            item.name,
            item.note ? `(${item.note})` : "",
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join("\n") ??
      initialDraft?.ingredients.join("\n") ??
      "",
    steps:
      recipe?.steps.map((step) => step.body).join("\n") ??
      initialDraft?.steps.join("\n") ??
      "",
  };
}

export function RecipeEditor({
  initialDraft,
  recipe,
  initialSource = "",
}: {
  initialDraft?: RecipeEditorDraft;
  recipe?: Recipe;
  initialSource?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(() =>
    stateFromRecipe(recipe, initialSource, initialDraft),
  );
  const [ingredientMode, setIngredientMode] =
    useState<IngredientEditMode>("text");
  const [ingredientRows, setIngredientRows] = useState(() =>
    ingredientRowsFromText(state.ingredients),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function update(key: keyof EditorState, value: string) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateIngredientText(value: string) {
    setState((current) => ({ ...current, ingredients: value }));
    setIngredientRows(ingredientRowsFromText(value));
  }

  function updateIngredientMode(mode: IngredientEditMode) {
    if (mode === ingredientMode) {
      return;
    }

    if (mode === "structured") {
      setIngredientRows(ingredientRowsFromText(state.ingredients));
    } else {
      setState((current) => ({
        ...current,
        ingredients: ingredientTextFromRows(ingredientRows),
      }));
    }

    setIngredientMode(mode);
  }

  function updateIngredientRow(
    id: string,
    key: keyof Omit<IngredientRow, "id">,
    value: string,
  ) {
    setIngredientRows((current) => {
      const next = current.map((row) =>
        row.id === id ? { ...row, [key]: value } : row,
      );
      setState((stateValue) => ({
        ...stateValue,
        ingredients: ingredientTextFromRows(next),
      }));
      return next;
    });
  }

  function addIngredientRow() {
    setIngredientRows((current) => {
      const next = [
        ...current,
        {
          id: `ingredient-new-${Date.now()}`,
          quantity: "",
          unit: "",
          name: "",
          note: "",
        },
      ];
      setState((stateValue) => ({
        ...stateValue,
        ingredients: ingredientTextFromRows(next),
      }));
      return next;
    });
  }

  function removeIngredientRow(id: string) {
    setIngredientRows((current) => {
      const next = current.filter((row) => row.id !== id);
      setState((stateValue) => ({
        ...stateValue,
        ingredients: ingredientTextFromRows(next),
      }));
      return next;
    });
  }

  function updateMealSlot(mealSlot: MealSlot, checked: boolean) {
    setState((current) => ({
      ...current,
      mealSlots: { ...current.mealSlots, [mealSlot]: checked },
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
      ingredients: ingredientRows
        .filter((row) => row.name.trim())
        .map(saveIngredientFromRow),
      steps: state.steps
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((body) => ({ body, timerMinutes: null })),
    };

    try {
      const response = await fetch(
        recipe ? `/api/recipes/${recipe.id}` : "/api/recipes",
        {
          method: recipe ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as {
        recipe?: Recipe;
        error?: string;
      };

      if (!response.ok || !body.recipe) {
        throw new Error(body.error ?? "Recipe could not be saved.");
      }

      router.push(`/library/${body.recipe.id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Recipe could not be saved.",
      );
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
        <input
          value={state.title}
          onChange={(event) => update("title", event.target.value)}
        />
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
        <input
          value={state.source}
          onChange={(event) => update("source", event.target.value)}
        />
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
        <input
          value={state.tags}
          onChange={(event) => update("tags", event.target.value)}
        />
      </label>
      <section className="ingredient-editor">
        <div className="ingredient-editor-header">
          <div>
            <h3>Ingredients</h3>
          </div>
          <div
            className="ingredient-mode-tabs"
            role="tablist"
            aria-label="Ingredient input mode"
          >
            <button
              aria-selected={ingredientMode === "text"}
              onClick={() => updateIngredientMode("text")}
              role="tab"
              type="button"
            >
              Text
            </button>
            <button
              aria-selected={ingredientMode === "structured"}
              onClick={() => updateIngredientMode("structured")}
              role="tab"
              type="button"
            >
              Fields
            </button>
          </div>
        </div>
        {ingredientMode === "structured" ? (
          <div className="ingredient-table-shell">
            <datalist id="ingredient-unit-options">
              {COMMON_UNITS.map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
            <table className="ingredient-table">
              <thead>
                <tr>
                  <th scope="col">Amt</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Ingredient</th>
                  <th scope="col">Note</th>
                  <th aria-label="Ingredient actions" scope="col" />
                </tr>
              </thead>
              <tbody>
                {ingredientRows.map((row, index) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        aria-label={`Ingredient ${index + 1} amount`}
                        inputMode="decimal"
                        onChange={(event) =>
                          updateIngredientRow(
                            row.id,
                            "quantity",
                            event.target.value,
                          )
                        }
                        placeholder="--"
                        value={row.quantity}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Ingredient ${index + 1} unit`}
                        list="ingredient-unit-options"
                        onChange={(event) =>
                          updateIngredientRow(
                            row.id,
                            "unit",
                            event.target.value,
                          )
                        }
                        placeholder="--"
                        value={row.unit}
                      />
                    </td>
                    <td>
                      <EditableIngredientCell
                        ariaLabel={`Ingredient ${index + 1} name`}
                        onChange={(value) =>
                          updateIngredientRow(row.id, "name", value)
                        }
                        placeholder="Ingredient"
                        value={row.name}
                      />
                    </td>
                    <td>
                      <EditableIngredientCell
                        ariaLabel={`Ingredient ${index + 1} note`}
                        onChange={(value) =>
                          updateIngredientRow(row.id, "note", value)
                        }
                        placeholder="--"
                        value={row.note}
                      />
                    </td>
                    <td>
                      <button
                        aria-label={`Remove ingredient ${index + 1}`}
                        className="ingredient-row-remove"
                        onClick={() => removeIngredientRow(row.id)}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="ingredient-add-row"
              onClick={addIngredientRow}
              type="button"
            >
              Add ingredient
            </button>
          </div>
        ) : (
          <textarea
            aria-label="Ingredients"
            rows={5}
            value={state.ingredients}
            onChange={(event) => updateIngredientText(event.target.value)}
          />
        )}
      </section>
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
