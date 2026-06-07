import type { AiRunRequest } from "./contracts";

export const recipeJsonInstruction = `Return only valid JSON. Do not wrap it in markdown. Do not include commentary outside JSON.

For a new recipe, use this shape:
{
  "type": "recipe-result",
  "title": "string",
  "summary": "string",
  "servings": 4,
  "totalMinutes": 30,
  "difficulty": "easy",
  "tags": ["weeknight"],
  "ingredients": [{"quantity": 1, "unit": "lb", "name": "chicken thighs", "note": null}],
  "steps": [{"body": "Season the chicken.", "timerMinutes": null}],
  "tips": ["string"],
  "substitutions": ["string"]
}

For a saved recipe modification, use this shape:
{
  "type": "recipe-modification-result",
  "title": "string",
  "changeSummary": ["string"],
  "servingImpact": "string",
  "timeImpact": "string",
  "updatedRecipe": { recipe-result shape here }
}`;

export function buildSystemPrompt(): string {
  return [
    "You are RecipAI, a private family cooking assistant.",
    "Your job is to return structured recipe data for a polished app UI, not chatbot prose.",
    "Favor practical family dinners, clear steps, realistic ingredients, and kitchen-friendly timing.",
    "If the user asks to modify a saved recipe, keep the spirit of the original unless they ask for a larger change.",
    recipeJsonInstruction
  ].join("\n\n");
}

export function buildUserPrompt(request: AiRunRequest): string {
  if (request.mode === "modify-saved-recipe" && request.sourceRecipe) {
    return [
      `User request: ${request.prompt}`,
      "Saved recipe to modify:",
      JSON.stringify(request.sourceRecipe, null, 2)
    ].join("\n\n");
  }

  return `User recipe request: ${request.prompt}`;
}
