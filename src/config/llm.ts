import "dotenv/config";

export type LlmProvider = "anthropic" | "gemini";

const DEFAULT_MODELS: Record<LlmProvider, string | undefined> = {
  anthropic: undefined,
  gemini: "gemini-2.5-flash",
};

export type LlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  model: string | undefined;
  maxTurns: number;
};

function parseProvider(raw: string | undefined): LlmProvider {
  const value = (raw ?? "anthropic").trim().toLowerCase();
  if (value === "anthropic" || value === "gemini") {
    return value;
  }
  throw new Error(
    `Invalid LLM_PROVIDER "${raw}". Expected "anthropic" or "gemini".`,
  );
}

function parseMaxTurns(raw: string | undefined): number {
  if (!raw?.trim()) return 10;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`Invalid LLM_MAX_TURNS "${raw}". Expected a positive integer.`);
  }
  return value;
}

function resolveApiKey(provider: LlmProvider): string {
  const key = process.env.API_KEY?.trim();
  if (!key) {
    throw new Error(
      `Missing API_KEY. Set it in .env to your ${provider} API key.`,
    );
  }
  return key;
}

export function loadLlmConfig(): LlmConfig {
  const provider = parseProvider(process.env.LLM_PROVIDER);
  const modelOverride = process.env.LLM_MODEL?.trim() || undefined;
  const model = modelOverride ?? DEFAULT_MODELS[provider];
  const maxTurns = parseMaxTurns(process.env.LLM_MAX_TURNS);

  return {
    provider,
    apiKey: resolveApiKey(provider),
    model,
    maxTurns,
  };
}

/** Resolved display label for CLI banner (includes default model names). */
export function formatLlmLabel(config: LlmConfig): string {
  const modelLabel =
    config.model ??
    (config.provider === "anthropic" ? "sdk default" : "gemini-2.5-flash");
  return `${config.provider} (${modelLabel})`;
}
