import { query } from "@anthropic-ai/claude-agent-sdk";
import type { LlmConfig } from "../config/llm.ts";
import { loadExternalMcpConfig } from "../config/mcp.ts";
import { buildSystemPrompt } from "../prompts.ts";
import { memoryMcpServer, memoryToolNames } from "../tools/memory-tools.ts";

function buildOptions(config: LlmConfig) {
  const externalMcp = loadExternalMcpConfig();

  return {
    systemPrompt: buildSystemPrompt(),
    mcpServers: {
      memory: memoryMcpServer,
      ...(externalMcp
        ? {
            [externalMcp.serverName]: {
              type: "http" as const,
              url: externalMcp.url,
            },
          }
        : {}),
    },
    allowedTools: [
      "WebSearch",
      "WebFetch",
      ...memoryToolNames,
      ...(externalMcp ? [`mcp__${externalMcp.serverName}__*`] : []),
    ],
    permissionMode: "bypassPermissions" as const,
    maxTurns: config.maxTurns,
    env: { ...process.env, ANTHROPIC_API_KEY: config.apiKey },
    ...(config.model ? { model: config.model } : {}),
  };
}

async function runQuery(
  config: LlmConfig,
  userMessage: string,
  sessionId?: string,
): Promise<{ reply: string; sessionId: string }> {
  const chunks: string[] = [];
  let outSessionId = "";

  for await (const message of query({
    prompt: userMessage,
    options: {
      ...buildOptions(config),
      ...(sessionId ? { resume: sessionId } : {}),
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      chunks.push(message.result);
      outSessionId = message.session_id;
    }
  }

  return { reply: chunks.join("\n").trim(), sessionId: outSessionId };
}

export async function runAnthropicAgent(
  config: LlmConfig,
  userMessage: string,
  sessionId?: string,
): Promise<{ reply: string; sessionId: string }> {
  if (sessionId) {
    try {
      return await runQuery(config, userMessage, sessionId);
    } catch {
      // Stale or deleted session — start fresh.
    }
  }
  return runQuery(config, userMessage);
}
