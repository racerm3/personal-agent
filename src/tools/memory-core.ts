import { z } from "zod";
import { saveMemory, searchMemories, listRecentMemories } from "../memory.ts";

export const SAVE_MEMORY_DESCRIPTION =
  "Save a piece of information to long-term memory. Use this when the user " +
  "tells you something worth remembering across conversations — preferences, " +
  "facts about them, decisions, ongoing projects, recurring people. " +
  "Don't save trivia from search results or things you can easily look up again. " +
  "If unsure, prefer saving — small over-recall is better than forgetting.";

export const SEARCH_MEMORY_DESCRIPTION =
  "Search long-term memory for relevant past information. Use this BEFORE " +
  "answering questions about the user's preferences, history, projects, or " +
  "anything they might have told you previously. A few keywords work best — " +
  "the search uses keyword matching, not semantic similarity.";

export const LIST_RECENT_DESCRIPTION =
  "List the most recently saved memories in reverse chronological order. " +
  "Use this when the user asks 'what have we talked about lately' or when " +
  "you want to check which tags you've been using before saving a new memory.";

export const saveMemoryInputSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe(
      "The memory itself, written as a complete self-contained sentence. " +
        "Good: 'User prefers tea over coffee, especially Earl Grey.' " +
        "Bad: 'tea' (too short, no context when retrieved later).",
    ),
  tags: z
    .array(z.string())
    .default([])
    .describe(
      "Short lowercase keywords for categorisation, e.g. ['preferences', 'food']. " +
        "Reuse existing tags when possible — check list_recent_memories first if unsure " +
        "what tags you've used before. 1-4 tags is plenty.",
    ),
});

export const searchMemoryInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Keywords to search for. Use 1-5 short words, not full sentences. " +
        "Good: 'coffee preferences'. Bad: 'what does the user like to drink in the morning'.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Max number of results to return. Default 5 is usually fine."),
});

export const listRecentInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("How many recent memories to list. Default 10."),
});

export type SaveMemoryInput = z.infer<typeof saveMemoryInputSchema>;
export type SearchMemoryInput = z.infer<typeof searchMemoryInputSchema>;
export type ListRecentInput = z.infer<typeof listRecentInputSchema>;

export async function handleSaveMemory(
  input: SaveMemoryInput,
): Promise<string> {
  const memory = saveMemory(input.text, input.tags);
  return `Saved memory #${memory.id}: "${memory.text}" [${memory.tags.join(", ") || "no tags"}]`;
}

export async function handleSearchMemory(
  input: SearchMemoryInput,
): Promise<string> {
  const memories = searchMemories(input.query, input.limit);
  if (memories.length === 0) {
    return `No memories matched "${input.query}".`;
  }
  return memories
    .map(
      (m) =>
        `#${m.id} [${m.created_at}] (${m.tags.join(", ") || "no tags"}): ${m.text}`,
    )
    .join("\n");
}

export async function handleListRecent(
  input: ListRecentInput,
): Promise<string> {
  const memories = listRecentMemories(input.limit);
  if (memories.length === 0) {
    return "No memories saved yet.";
  }
  return memories
    .map(
      (m) =>
        `#${m.id} [${m.created_at}] (${m.tags.join(", ") || "no tags"}): ${m.text}`,
    )
    .join("\n");
}
