import {
  aiStructuredResultSchema,
  type AiClient,
  type AiProvider,
  type AiRunRequest,
  type AiStructuredResult
} from "./contracts";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const providerDefaults: Record<AiProvider, { baseUrl: string; model: string; keyEnv: string }> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    keyEnv: "OPENAI_API_KEY"
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    keyEnv: "DEEPSEEK_API_KEY"
  }
};

export class MissingApiKeyError extends Error {
  constructor(provider: AiProvider, envName: string) {
    super(`Missing ${envName} for ${provider}.`);
    this.name = "MissingApiKeyError";
  }
}

export class InvalidAiResponseError extends Error {
  constructor(message = "The provider response could not be formatted as a recipe.") {
    super(message);
    this.name = "InvalidAiResponseError";
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]);
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new InvalidAiResponseError();
  }
}

export function getConfiguredProvider(value = process.env.AI_PROVIDER): AiProvider {
  return value === "openai" ? "openai" : "deepseek";
}

export function createChatAiClient(provider: AiProvider = getConfiguredProvider()): AiClient {
  const defaults = providerDefaults[provider];
  const apiKey = process.env[defaults.keyEnv];

  if (!apiKey) {
    throw new MissingApiKeyError(provider, defaults.keyEnv);
  }

  return {
    async runRecipePrompt(request: AiRunRequest): Promise<AiStructuredResult> {
      const messages: ChatMessage[] = [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(request) }
      ];

      const response = await fetch(`${defaults.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: defaults.model,
          messages,
          temperature: 0.6,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`AI provider request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as ChatResponse;
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        throw new InvalidAiResponseError("The provider returned an empty response.");
      }

      const parsed = extractJson(content);
      return aiStructuredResultSchema.parse(parsed);
    }
  };
}

export function parseStructuredAiText(text: string): AiStructuredResult {
  return aiStructuredResultSchema.parse(extractJson(text));
}
