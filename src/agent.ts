import { query } from "@anthropic-ai/claude-agent-sdk";
import "dotenv/config";
import { memoryMcpServer, memoryToolNames } from "./tools/memory-tools.ts"

/**
 * One-paragraph system prompt. Notice we don't list every tool or instruction —
 * the tool descriptions themselves do that work. This prompt's only job is to
 * remind the agent it HAS memory at all, so it doesn't forget to use it.
 *
 * Try removing this prompt and watching the agent confidently make stuff up
 * instead of searching its memory first. The difference is striking.
 */
const SYSTEM_PROMPT = `
You are a personal assistant with long-term memory. Before answering questions
about the user, their preferences, ongoing projects, or anything they may have
told you previously, search your memory first. When the user shares something
worth remembering across conversations, save it. Be proactive about both.
`.trim();

const BASE_OPTIONS = {
  systemPrompt: SYSTEM_PROMPT,
  mcpServers: { memory: memoryMcpServer },
  allowedTools: ["WebSearch", "WebFetch", ...memoryToolNames],
  permissionMode: "bypassPermissions" as const,
  maxTurns: 10,
};

async function runQuery(
  userMessage: string,
  sessionId?: string,
): Promise<{ reply: string; sessionId: string }> {
  const chunks: string[] = [];
  let outSessionId = "";

  for await (const message of query({
    prompt: userMessage,
    options: { ...BASE_OPTIONS, ...(sessionId ? { resume: sessionId } : {}) },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      chunks.push(message.result);
      outSessionId = message.session_id;
    }
  }

  return { reply: chunks.join("\n").trim(), sessionId: outSessionId };
}

export async function runAgent(
  userMessage: string,
  sessionId?: string,
): Promise<{ reply: string; sessionId: string }> {
  if (sessionId) {
    try {
      return await runQuery(userMessage, sessionId);
    } catch {
      // Stale or deleted session — start fresh.
    }
  }
  return runQuery(userMessage);
}
