import type { FunctionDeclaration } from "@google/genai";
import {
  SAVE_MEMORY_DESCRIPTION,
  SEARCH_MEMORY_DESCRIPTION,
  LIST_RECENT_DESCRIPTION,
  saveMemoryInputSchema,
  searchMemoryInputSchema,
  listRecentInputSchema,
  handleSaveMemory,
  handleSearchMemory,
  handleListRecent,
} from "./memory-core.ts";

export const geminiMemoryDeclarations: FunctionDeclaration[] = [
  {
    name: "save_memory",
    description: SAVE_MEMORY_DESCRIPTION,
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: saveMemoryInputSchema.shape.text.description },
        tags: {
          type: "array",
          items: { type: "string" },
          description: saveMemoryInputSchema.shape.tags.description,
        },
      },
      required: ["text"],
    },
  },
  {
    name: "search_memory",
    description: SEARCH_MEMORY_DESCRIPTION,
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: searchMemoryInputSchema.shape.query.description },
        limit: {
          type: "integer",
          description: searchMemoryInputSchema.shape.limit.description,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_recent_memories",
    description: LIST_RECENT_DESCRIPTION,
    parametersJsonSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: listRecentInputSchema.shape.limit.description,
        },
      },
    },
  },
];

export const geminiMemoryTools = [{ functionDeclarations: geminiMemoryDeclarations }];

export async function executeMemoryTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: string }> {
  switch (name) {
    case "save_memory": {
      const input = saveMemoryInputSchema.parse(args);
      return { result: await handleSaveMemory(input) };
    }
    case "search_memory": {
      const input = searchMemoryInputSchema.parse(args);
      return { result: await handleSearchMemory(input) };
    }
    case "list_recent_memories": {
      const input = listRecentInputSchema.parse(args);
      return { result: await handleListRecent(input) };
    }
    default:
      return { result: `Unknown tool: ${name}` };
  }
}
