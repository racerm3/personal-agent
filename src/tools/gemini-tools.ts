import type { FunctionDeclaration } from "@google/genai";
import { loadExternalMcpConfig } from "../config/mcp.ts";
import {
  listExternalTools,
  callExternalTool,
  type ExternalMcpTool,
} from "../mcp/external-client.ts";
import {
  geminiMemoryDeclarations,
  executeMemoryTool,
} from "./memory-gemini.ts";

const MEMORY_TOOL_NAMES = new Set([
  "save_memory",
  "search_memory",
  "list_recent_memories",
]);

function mcpToolToDeclaration(tool: ExternalMcpTool): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.inputSchema,
  };
}

export async function loadGeminiTools() {
  const declarations: FunctionDeclaration[] = [...geminiMemoryDeclarations];

  if (loadExternalMcpConfig()) {
    const externalTools = await listExternalTools();
    declarations.push(...externalTools.map(mcpToolToDeclaration));
  }

  return [{ functionDeclarations: declarations }];
}

export async function executeGeminiTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: string }> {
  if (MEMORY_TOOL_NAMES.has(name)) {
    return executeMemoryTool(name, args);
  }

  return callExternalTool(name, args);
}
