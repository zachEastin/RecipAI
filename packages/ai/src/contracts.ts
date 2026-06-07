import { z } from "zod";

export const aiProviderSchema = z.enum(["openai", "deepseek"]);

export const aiPromptModeSchema = z.enum([
  "general-recipe",
  "modify-saved-recipe",
  "meal-plan",
  "shopping-list"
]);

export const recipeResultSchema = z.object({
  type: z.literal("recipe-result"),
  title: z.string(),
  summary: z.string(),
  servings: z.number().int().positive(),
  totalMinutes: z.number().int().positive(),
  difficulty: z.enum(["easy", "medium", "project"]),
  tags: z.array(z.string()),
  ingredients: z.array(
    z.object({
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      name: z.string(),
      note: z.string().nullable()
    })
  ),
  steps: z.array(
    z.object({
      body: z.string(),
      timerMinutes: z.number().int().positive().nullable()
    })
  ),
  tips: z.array(z.string()),
  substitutions: z.array(z.string())
});

export const recipeModificationResultSchema = z.object({
  type: z.literal("recipe-modification-result"),
  title: z.string(),
  changeSummary: z.array(z.string()),
  servingImpact: z.string(),
  timeImpact: z.string(),
  updatedRecipe: recipeResultSchema
});

export const aiStructuredResultSchema = z.discriminatedUnion("type", [
  recipeResultSchema,
  recipeModificationResultSchema
]);

export type AiProvider = z.infer<typeof aiProviderSchema>;
export type AiPromptMode = z.infer<typeof aiPromptModeSchema>;
export type RecipeResult = z.infer<typeof recipeResultSchema>;
export type RecipeModificationResult = z.infer<typeof recipeModificationResultSchema>;
export type AiStructuredResult = z.infer<typeof aiStructuredResultSchema>;

export type AiRunRequest = {
  provider: AiProvider;
  mode: AiPromptMode;
  prompt: string;
  sourceRecipeId?: string;
};

export type AiClient = {
  runRecipePrompt(request: AiRunRequest): Promise<AiStructuredResult>;
};
