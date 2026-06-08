import { randomUUID } from "node:crypto";
import {
  GoogleGenAI,
  createUserContent,
  createPartFromFunctionResponse,
  type Content,
  type GenerateContentResponse,
} from "@google/genai";
import type { LlmConfig } from "../config/llm.ts";
import { buildSystemPrompt } from "../prompts.ts";
import { loadGeminiTools, executeGeminiTool } from "../tools/gemini-tools.ts";
import {
  loadGeminiHistory,
  persistGeminiHistory,
} from "../sessions.ts";

function getModel(config: LlmConfig): string {
  return config.model ?? "gemini-2.5-flash";
}

async function runQuery(
  config: LlmConfig,
  userMessage: string,
  sessionId?: string,
): Promise<{ reply: string; sessionId: string }> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const model = getModel(config);
  const tools = await loadGeminiTools();

  let activeSessionId = sessionId ?? randomUUID();
  let contents: Content[] = [];

  if (sessionId) {
    const history = loadGeminiHistory(sessionId);
    if (!history) {
      activeSessionId = randomUUID();
    } else {
      contents = history;
    }
  }

  contents.push(createUserContent(userMessage));

  let lastResponse: GenerateContentResponse | undefined;

  for (let turn = 0; turn < config.maxTurns; turn++) {
    lastResponse = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(),
        tools,
      },
    });

    const modelContent = lastResponse.candidates?.[0]?.content;
    if (!modelContent) {
      break;
    }
    contents.push(modelContent);

    const calls = lastResponse.functionCalls ?? [];
    if (calls.length === 0) {
      break;
    }

    const responseParts = [];
    for (const call of calls) {
      if (!call.name) continue;
      const { result } = await executeGeminiTool(call.name, call.args ?? {});
      responseParts.push(
        createPartFromFunctionResponse(
          call.id ?? call.name,
          call.name,
          { result },
        ),
      );
    }

    if (responseParts.length === 0) {
      break;
    }

    contents.push({ role: "user", parts: responseParts });
  }

  const reply = lastResponse?.text?.trim() ?? "";
  persistGeminiHistory(activeSessionId, contents);
  return { reply, sessionId: activeSessionId };
}

export async function runGeminiAgent(
  config: LlmConfig,
  userMessage: string,
  sessionId?: string,
): Promise<{ reply: string; sessionId: string }> {
  if (sessionId) {
    try {
      return await runQuery(config, userMessage, sessionId);
    } catch {
      // Stale or corrupted transcript — start fresh.
    }
  }
  return runQuery(config, userMessage);
}
