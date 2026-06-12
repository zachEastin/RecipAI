"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, ImageIcon, Link as LinkIcon, Search, Trash2, Upload, X } from "lucide-react";

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
  imageUrl: string | null;
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
  imageUrl?: string | null;
  provenance?: Recipe["provenance"];
};

type ImageSuggestion = {
  id: string;
  imageUrl: string;
  sourceLabel: string;
  sourceUrl: string | null;
  title: string;
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
    imageUrl: recipe?.imageUrl ?? initialDraft?.imageUrl ?? null,
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
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [imageSuggestions, setImageSuggestions] = useState<ImageSuggestion[]>(
    [],
  );
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [isImageWorking, setIsImageWorking] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function update(key: keyof EditorState, value: string) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateImageUrl(imageUrl: string | null) {
    setState((current) => ({ ...current, imageUrl }));
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

  async function uploadImageFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setImageError(null);
    setIsImageWorking(true);

    try {
      const formData = new FormData();
      formData.set("image", file);

      const response = await fetch("/api/recipe-images/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        imageUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.imageUrl) {
        throw new Error(payload.error ?? "Image could not be uploaded.");
      }

      updateImageUrl(payload.imageUrl);
      setIsImagePickerOpen(false);
    } catch (caught) {
      setImageError(
        caught instanceof Error ? caught.message : "Image could not be uploaded.",
      );
    } finally {
      setIsImageWorking(false);
    }
  }

  async function handleImageInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    await uploadImageFile(file);
  }

  async function importImageUrl(imageUrl: string) {
    setImageError(null);
    setIsImageWorking(true);

    try {
      const response = await fetch("/api/recipe-images/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const payload = (await response.json()) as {
        imageUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.imageUrl) {
        throw new Error(payload.error ?? "Image URL could not be imported.");
      }

      updateImageUrl(payload.imageUrl);
      setImageUrlInput("");
      setIsImagePickerOpen(false);
    } catch (caught) {
      setImageError(
        caught instanceof Error
          ? caught.message
          : "Image URL could not be imported.",
      );
    } finally {
      setIsImageWorking(false);
    }
  }

  async function searchImageSuggestions() {
    const query = state.title.trim();

    if (!query) {
      setImageError("Enter a title before searching for image options.");
      return;
    }

    setImageError(null);
    setIsImageWorking(true);

    try {
      const response = await fetch(
        `/api/recipe-images/search?q=${encodeURIComponent(query)}`,
      );
      const payload = (await response.json()) as {
        images?: ImageSuggestion[];
        error?: string;
      };

      if (!response.ok || !payload.images) {
        throw new Error(payload.error ?? "Image search could not be completed.");
      }

      setImageSuggestions(payload.images);

      if (payload.images.length === 0) {
        setImageError("No image options found for this recipe title.");
      }
    } catch (caught) {
      setImageError(
        caught instanceof Error
          ? caught.message
          : "Image search could not be completed.",
      );
    } finally {
      setIsImageWorking(false);
    }
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
      imageUrl: state.imageUrl,
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
      <section className="recipe-image-field" aria-label="Thumbnail">
        <h3>Thumbnail</h3>
        <div className="recipe-image-editor">
          <button
            aria-expanded={isImagePickerOpen}
            className="recipe-image-button"
            onClick={() => setIsImagePickerOpen((value) => !value)}
            type="button"
          >
            {state.imageUrl ? (
              <Image
                alt=""
                height={74}
                src={state.imageUrl}
                style={{ height: 74, objectFit: "cover", width: 74 }}
                unoptimized
                width={74}
              />
            ) : (
              <span className="recipe-image-empty">
                <ImageIcon aria-hidden="true" size={28} />
              </span>
            )}
            <span>
              {state.imageUrl ? "Change thumbnail" : "Add thumbnail"}
            </span>
          </button>
          {state.imageUrl ? (
            <button
              className="recipe-image-remove"
              onClick={() => updateImageUrl(null)}
              type="button"
            >
              <X aria-hidden="true" size={16} />
              Remove
            </button>
          ) : null}
        </div>
      </section>
      {isImagePickerOpen ? (
        <section className="recipe-image-picker" aria-label="Recipe thumbnail picker">
          {imageError ? <p className="image-picker-error">{imageError}</p> : null}
          <div className="image-picker-actions">
            <button
              disabled={isImageWorking}
              onClick={() => void searchImageSuggestions()}
              type="button"
            >
              <Search aria-hidden="true" size={17} />
              Search title
            </button>
            <button
              disabled={isImageWorking}
              onClick={() => cameraInputRef.current?.click()}
              type="button"
            >
              <Camera aria-hidden="true" size={17} />
              Camera
            </button>
            <button
              disabled={isImageWorking}
              onClick={() => uploadInputRef.current?.click()}
              type="button"
            >
              <Upload aria-hidden="true" size={17} />
              Upload
            </button>
          </div>
          <input
            ref={cameraInputRef}
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => void handleImageInputChange(event)}
            type="file"
          />
          <input
            ref={uploadInputRef}
            accept="image/*"
            hidden
            onChange={(event) => void handleImageInputChange(event)}
            type="file"
          />
          {imageSuggestions.length > 0 ? (
            <div className="image-suggestion-grid">
              {imageSuggestions.map((suggestion, index) => (
                <button
                  disabled={isImageWorking}
                  key={suggestion.id}
                  onClick={() => void importImageUrl(suggestion.imageUrl)}
                  type="button"
                >
                  <Image
                    alt=""
                    height={82}
                    priority={index === 0}
                    src={suggestion.imageUrl}
                    style={{ height: "auto", objectFit: "cover", width: "100%" }}
                    unoptimized
                    width={96}
                  />
                  <span>{suggestion.sourceLabel}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="image-url-import">
            <label>
              Image URL
              <input
                inputMode="url"
                onChange={(event) => setImageUrlInput(event.target.value)}
                placeholder="https://example.com/photo.jpg"
                value={imageUrlInput}
              />
            </label>
            {imageUrlInput ? (
              <div className="image-url-preview">
                <Image
                  alt=""
                  height={64}
                  src={imageUrlInput}
                  style={{ height: 64, objectFit: "cover", width: 72 }}
                  unoptimized
                  width={72}
                />
                <button
                  disabled={isImageWorking}
                  onClick={() => void importImageUrl(imageUrlInput)}
                  type="button"
                >
                  <LinkIcon aria-hidden="true" size={17} />
                  Use URL
                </button>
              </div>
            ) : null}
          </div>
        </section>
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
