import "dotenv/config";
import { loadLlmConfig } from "./config/llm.ts";
import { runAnthropicAgent } from "./providers/anthropic.ts";
import { runGeminiAgent } from "./providers/gemini.ts";

export async function runAgent(
  userMessage: string,
  sessionId?: string,
): Promise<{ reply: string; sessionId: string }> {
  const config = loadLlmConfig();

  if (config.provider === "gemini") {
    return runGeminiAgent(config, userMessage, sessionId);
  }

  return runAnthropicAgent(config, userMessage, sessionId);
}

export { loadLlmConfig, formatLlmLabel } from "./config/llm.ts";
