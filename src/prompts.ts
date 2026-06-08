import { loadExternalMcpConfig } from "./config/mcp.ts";

const BASE_SYSTEM_PROMPT = `
You are a personal assistant with long-term memory. Before answering questions
about the user, their preferences, ongoing projects, or anything they may have
told you previously, search your memory first. When the user shares something
worth remembering across conversations, save it. Be proactive about both.
`.trim();

export function buildSystemPrompt(): string {
  const externalMcp = loadExternalMcpConfig();
  if (!externalMcp) {
    return BASE_SYSTEM_PROMPT;
  }

  return `${BASE_SYSTEM_PROMPT}\n\nYou also have access to external ${externalMcp.serverName}-mcp tools for additional capabilities — use them when relevant.`;
}

/** @deprecated Use buildSystemPrompt() */
export const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;
