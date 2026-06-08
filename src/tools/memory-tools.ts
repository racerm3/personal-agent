import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
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

const saveMemoryTool = tool(
  "save_memory",
  SAVE_MEMORY_DESCRIPTION,
  {
    text: saveMemoryInputSchema.shape.text,
    tags: saveMemoryInputSchema.shape.tags,
  },
  async ({ text, tags }) => ({
    content: [
      {
        type: "text" as const,
        text: await handleSaveMemory({ text, tags }),
      },
    ],
  }),
);

const searchMemoryTool = tool(
  "search_memory",
  SEARCH_MEMORY_DESCRIPTION,
  {
    query: searchMemoryInputSchema.shape.query,
    limit: searchMemoryInputSchema.shape.limit,
  },
  async ({ query, limit }) => ({
    content: [
      {
        type: "text" as const,
        text: await handleSearchMemory({ query, limit }),
      },
    ],
  }),
);

const listRecentTool = tool(
  "list_recent_memories",
  LIST_RECENT_DESCRIPTION,
  {
    limit: listRecentInputSchema.shape.limit,
  },
  async ({ limit }) => ({
    content: [
      {
        type: "text" as const,
        text: await handleListRecent({ limit }),
      },
    ],
  }),
);

export const memoryMcpServer = createSdkMcpServer({
  name: "memory",
  version: "0.1.0",
  tools: [saveMemoryTool, searchMemoryTool, listRecentTool],
});

export const memoryToolNames = [
  "mcp__memory__save_memory",
  "mcp__memory__search_memory",
  "mcp__memory__list_recent_memories",
] as const;
