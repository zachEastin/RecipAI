"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Bot,
  Camera,
  Check,
  Clipboard,
  ClipboardPaste,
  Copy,
  ImageIcon,
  Link as LinkIcon,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { aiStructuredResultSchema, type AiStructuredResult, type RecipeResult } from "@recipai/ai";
import { inferRecipeMealSlots, MEAL_SLOTS, type MealSlot, type Recipe } from "@recipai/recipes";

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

type ImportedRecipePreview = {
  current: EditorState;
  draft: EditorState;
  result: AiStructuredResult;
};

type PreviewField = {
  current: string | string[];
  imported: string | string[];
  key: string;
  label: string;
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

function splitTotalMinutes(totalMinutes: number): {
  cookMinutes: number;
  prepMinutes: number;
} {
  const prepMinutes = Math.min(20, Math.max(0, Math.round(totalMinutes * 0.25)));

  return {
    cookMinutes: Math.max(0, totalMinutes - prepMinutes),
    prepMinutes,
  };
}

function formatIngredientLine(ingredient: RecipeResult["ingredients"][number]) {
  return [
    ingredient.quantity ?? "",
    ingredient.unit ?? "",
    ingredient.name,
    ingredient.note ? `(${ingredient.note})` : "",
  ]
    .map((part) => String(part).trim())
    .filter(Boolean)
    .join(" ");
}

function recipeResultFromAiResult(result: AiStructuredResult): RecipeResult {
  return result.type === "recipe-modification-result" ? result.updatedRecipe : result;
}

function stateFromAiResult(
  result: AiStructuredResult,
  current: EditorState,
): EditorState {
  const recipeResult = recipeResultFromAiResult(result);
  const { cookMinutes, prepMinutes } = splitTotalMinutes(recipeResult.totalMinutes);

  return {
    title: recipeResult.title,
    summary: recipeResult.summary,
    source: current.source,
    servings: String(recipeResult.servings),
    prepMinutes: String(prepMinutes),
    cookMinutes: String(cookMinutes),
    imageUrl: current.imageUrl,
    mealSlots: Object.fromEntries(
      MEAL_SLOTS.map((slot) => [
        slot,
        inferRecipeMealSlots(recipeResult).includes(slot),
      ]),
    ) as Record<MealSlot, boolean>,
    tags: recipeResult.tags.join(", "),
    ingredients: recipeResult.ingredients.map(formatIngredientLine).join("\n"),
    steps: recipeResult.steps.map((step) => step.body).join("\n"),
  };
}

function extractJsonFromClipboardText(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

    if (fenced?.[1]) {
      return JSON.parse(fenced[1]);
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("Clipboard does not contain a JSON recipe result.");
  }
}

function normalizePreviewValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join("\n") : value;
}

function previewValueChanged(current: string | string[], imported: string | string[]) {
  return normalizePreviewValue(current).trim() !== normalizePreviewValue(imported).trim();
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

function buildRecipePayload(
  state: EditorState,
  ingredientRows: IngredientRow[],
  recipe?: Recipe,
  initialDraft?: RecipeEditorDraft,
  imported = false,
) {
  return {
    id: recipe?.id,
    title: state.title,
    summary: state.summary,
    source: state.source || null,
    servings: Number(state.servings),
    prepMinutes: Number(state.prepMinutes),
    cookMinutes: Number(state.cookMinutes),
    mealSlots: MEAL_SLOTS.filter((slot) => state.mealSlots[slot]),
    rating: imported ? 0 : (recipe?.rating ?? 0),
    tags: state.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    favorite: imported ? false : (recipe?.favorite ?? false),
    imageUrl: state.imageUrl,
    provenance: imported
      ? "ai-generated"
      : (recipe?.provenance ?? initialDraft?.provenance ?? "manual"),
    ingredients: ingredientRows
      .filter((row) => row.name.trim())
      .map(saveIngredientFromRow),
    steps: state.steps
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((body) => ({ body, timerMinutes: null })),
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
  const [aiPromptChanges, setAiPromptChanges] = useState("");
  const [aiImportError, setAiImportError] = useState<string | null>(null);
  const [aiImportPreview, setAiImportPreview] =
    useState<ImportedRecipePreview | null>(null);
  const [isAiHelperOpen, setIsAiHelperOpen] = useState(false);
  const [isImportSaving, setIsImportSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  function currentEditorState() {
    if (ingredientMode === "structured") {
      return {
        ...state,
        ingredients: ingredientTextFromRows(ingredientRows),
      };
    }

    return state;
  }

  function currentIngredientRows() {
    return ingredientMode === "structured"
      ? ingredientRows
      : ingredientRowsFromText(state.ingredients);
  }

  function buildManualAiPrompt() {
    const currentState = currentEditorState();
    const recipeForAi = {
      title: currentState.title,
      summary: currentState.summary,
      source: currentState.source || null,
      servings: Number(currentState.servings),
      prepMinutes: Number(currentState.prepMinutes),
      cookMinutes: Number(currentState.cookMinutes),
      mealSlots: MEAL_SLOTS.filter((slot) => currentState.mealSlots[slot]),
      tags: currentState.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      ingredients: currentState.ingredients
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      steps: currentState.steps
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };

    return [
      "You are improving a recipe for a recipe app.",
      "Make this a fuller, clearer recipe while keeping the spirit of the current recipe unless my requested changes say otherwise.",
      aiPromptChanges.trim()
        ? `Requested changes: ${aiPromptChanges.trim()}`
        : "Requested changes: make the recipe fuller with clearer ingredients, steps, timing, and useful tags.",
      "Return only one fenced json code block. Do not add prose before or after it.",
      "Use this exact JSON shape:",
      "```json",
      JSON.stringify(
        {
          type: "recipe-modification-result",
          title: "string",
          changeSummary: ["string"],
          servingImpact: "string",
          timeImpact: "string",
          updatedRecipe: {
            type: "recipe-result",
            title: "string",
            summary: "string",
            servings: 4,
            totalMinutes: 30,
            difficulty: "easy",
            tags: ["weeknight"],
            ingredients: [
              {
                quantity: 1,
                unit: "lb",
                name: "ingredient name",
                note: null,
              },
            ],
            steps: [{ body: "Step instructions.", timerMinutes: null }],
            tips: ["string"],
            substitutions: ["string"],
          },
        },
        null,
        2,
      ),
      "```",
      "Current recipe:",
      "```json",
      JSON.stringify(recipeForAi, null, 2),
      "```",
    ].join("\n\n");
  }

  async function copyManualAiPrompt() {
    setAiImportError(null);
    const prompt = buildManualAiPrompt();

    try {
      await navigator.clipboard.writeText(prompt);
      showToast("AI prompt copied.");
    } catch {
      const copyTarget = document.createElement("textarea");
      copyTarget.value = prompt;
      copyTarget.setAttribute("readonly", "");
      copyTarget.style.left = "-9999px";
      copyTarget.style.position = "fixed";
      document.body.append(copyTarget);
      copyTarget.select();
      const didCopy = document.execCommand("copy");
      copyTarget.remove();

      if (didCopy) {
        showToast("AI prompt copied.");
      } else {
        setAiImportError(
          "Clipboard access is blocked. Select and copy the prompt manually.",
        );
      }
    }
  }

  async function importManualAiResult() {
    setAiImportError(null);

    try {
      const text = await navigator.clipboard.readText();

      if (!text.trim()) {
        throw new Error("Clipboard is empty.");
      }

      const currentDraft = currentEditorState();
      const parsed = aiStructuredResultSchema.parse(extractJsonFromClipboardText(text));
      const nextDraft = stateFromAiResult(parsed, currentDraft);
      setAiImportPreview({ current: currentDraft, draft: nextDraft, result: parsed });
      setState(nextDraft);
      setIngredientRows(ingredientRowsFromText(nextDraft.ingredients));
      setIngredientMode("text");
      showToast("AI recipe imported for review.");
    } catch (caught) {
      setAiImportError(
        caught instanceof Error
          ? caught.message
          : "Clipboard did not contain a valid AI recipe.",
      );
    }
  }

  async function saveImportedRecipe(mode: "new" | "override") {
    if (!aiImportPreview) {
      return;
    }

    setAiImportError(null);
    setIsImportSaving(true);

    const draftRows = ingredientRowsFromText(aiImportPreview.draft.ingredients);
    const payload = buildRecipePayload(
      aiImportPreview.draft,
      draftRows,
      mode === "override" ? recipe : undefined,
      initialDraft,
      true,
    );

    try {
      const replacing = mode === "override" && recipe;
      const response = await fetch(
        replacing ? `/api/recipes/${recipe.id}` : "/api/recipes",
        {
          method: replacing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            replacing ? payload : { ...payload, id: undefined },
          ),
        },
      );
      const body = (await response.json()) as {
        recipe?: Recipe;
        error?: string;
      };

      if (!response.ok || !body.recipe) {
        throw new Error(body.error ?? "Imported recipe could not be saved.");
      }

      router.push(`/library/${body.recipe.id}`);
      router.refresh();
    } catch (caught) {
      setAiImportError(
        caught instanceof Error
          ? caught.message
          : "Imported recipe could not be saved.",
      );
    } finally {
      setIsImportSaving(false);
    }
  }

  function closeAiHelper() {
    if (aiImportPreview) {
      setState(aiImportPreview.current);
      setIngredientRows(ingredientRowsFromText(aiImportPreview.current.ingredients));
      setIngredientMode("text");
    }

    setIsAiHelperOpen(false);
    setAiImportError(null);
    setAiImportPreview(null);
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

    const currentState = currentEditorState();
    const payload = buildRecipePayload(
      currentState,
      currentIngredientRows(),
      recipe,
      initialDraft,
    );

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

  const previewFields: PreviewField[] = aiImportPreview
    ? [
        {
          current: aiImportPreview.current.title,
          imported: aiImportPreview.draft.title,
          key: "title",
          label: "Title",
        },
        {
          current: aiImportPreview.current.summary,
          imported: aiImportPreview.draft.summary,
          key: "summary",
          label: "Summary",
        },
        {
          current: `${aiImportPreview.current.prepMinutes} prep, ${aiImportPreview.current.cookMinutes} cook, ${aiImportPreview.current.servings} servings`,
          imported: `${aiImportPreview.draft.prepMinutes} prep, ${aiImportPreview.draft.cookMinutes} cook, ${aiImportPreview.draft.servings} servings`,
          key: "timing",
          label: "Timing",
        },
        {
          current: aiImportPreview.current.tags,
          imported: aiImportPreview.draft.tags,
          key: "tags",
          label: "Tags",
        },
        {
          current: aiImportPreview.current.ingredients.split("\n").filter(Boolean),
          imported: aiImportPreview.draft.ingredients.split("\n").filter(Boolean),
          key: "ingredients",
          label: "Ingredients",
        },
        {
          current: aiImportPreview.current.steps.split("\n").filter(Boolean),
          imported: aiImportPreview.draft.steps.split("\n").filter(Boolean),
          key: "steps",
          label: "Steps",
        },
      ]
    : [];

  return (
    <>
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
      <section className="manual-ai-panel" aria-label="AI recipe expansion">
        <div>
          <p className="result-label">Manual AI helper</p>
          <h3>Expand with ChatGPT</h3>
        </div>
        <Button
          onClick={() => setIsAiHelperOpen(true)}
          type="button"
          variant="secondary"
        >
          <Bot aria-hidden="true" size={18} />
          Open helper
        </Button>
      </section>
      <Button className="full-width" disabled={isSaving} type="submit">
        {isSaving ? "Saving..." : "Save recipe"}
      </Button>
    </form>
    {isAiHelperOpen ? (
      <div
        className="recipe-picker-backdrop ai-import-backdrop"
        onClick={closeAiHelper}
        role="presentation"
      >
        <section
          aria-labelledby="ai-import-title"
          aria-modal="true"
          className="ai-import-sheet"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="recipe-picker-header ai-import-header">
            <div>
              <p className="result-label">Manual AI helper</p>
              <h2 id="ai-import-title">Expand recipe with AI</h2>
              <p>Copy a prompt, run it in any AI chat, then copy the JSON result back here.</p>
            </div>
            <button
              aria-label="Close AI import helper"
              className="icon-toggle"
              onClick={closeAiHelper}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          {aiImportError ? (
            <div className="error-panel">
              <strong>Import failed</strong>
              <p>{aiImportError}</p>
            </div>
          ) : null}

          <label className="ai-import-change-field">
            Desired changes
            <textarea
              onChange={(event) => setAiPromptChanges(event.target.value)}
              placeholder="Make it more detailed, double the sauce, add grill instructions..."
              rows={4}
              value={aiPromptChanges}
            />
          </label>

          <div className="ai-import-actions">
            <Button onClick={() => void copyManualAiPrompt()} type="button">
              <Copy aria-hidden="true" size={17} />
              Copy prompt
            </Button>
            <Button
              onClick={() => void importManualAiResult()}
              type="button"
              variant="secondary"
            >
              <ClipboardPaste aria-hidden="true" size={17} />
              Import clipboard
            </Button>
          </div>

          <details className="ai-prompt-preview">
            <summary>
              <Clipboard aria-hidden="true" size={16} />
              Prompt preview
            </summary>
            <textarea readOnly rows={10} value={buildManualAiPrompt()} />
          </details>

          {aiImportPreview ? (
            <section className="ai-import-preview" aria-label="Imported recipe preview">
              <div className="ai-import-preview-heading">
                <Sparkles aria-hidden="true" size={18} />
                <div>
                  <h3>{aiImportPreview.draft.title}</h3>
                  <p>
                    {aiImportPreview.result.type === "recipe-modification-result"
                      ? aiImportPreview.result.changeSummary.join(" ")
                      : "Imported recipe is ready to save."}
                  </p>
                </div>
              </div>
              <div className="ai-diff-list">
                {previewFields.map((field) => {
                  const changed = previewValueChanged(field.current, field.imported);

                  return (
                    <article
                      className={changed ? "ai-diff-row ai-diff-row-changed" : "ai-diff-row"}
                      key={field.key}
                    >
                      <h4>
                        {changed ? <Check aria-hidden="true" size={15} /> : null}
                        {field.label}
                      </h4>
                      <div className="ai-diff-columns">
                        <div>
                          <span>Current</span>
                          <pre>{normalizePreviewValue(field.current) || "--"}</pre>
                        </div>
                        <div>
                          <span>Imported</span>
                          <pre>{normalizePreviewValue(field.imported) || "--"}</pre>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="ai-save-options">
                <Button
                  disabled={isImportSaving}
                  onClick={() => void saveImportedRecipe("override")}
                  type="button"
                >
                  Override
                </Button>
                <Button
                  disabled={isImportSaving}
                  onClick={() => void saveImportedRecipe("new")}
                  type="button"
                  variant="secondary"
                >
                  Save as new
                </Button>
                <Button
                  disabled={isImportSaving}
                  onClick={closeAiHelper}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            </section>
          ) : null}
        </section>
      </div>
    ) : null}
    {toast ? (
      <div className="toast-notice" role="status">
        {toast}
      </div>
    ) : null}
    </>
  );
}
