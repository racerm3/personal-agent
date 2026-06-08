import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Content } from "@google/genai";

const SESSION_PATH = process.env.AGENT_SESSION_PATH ?? "data/session.json";
const TRANSCRIPTS_DIR = process.env.AGENT_TRANSCRIPTS_PATH ?? "data/transcripts";

export type SessionMeta = {
  sessionId?: string;
  provider?: string;
};

export function loadSessionMeta(): SessionMeta {
  try {
    const parsed = JSON.parse(readFileSync(SESSION_PATH, "utf8"));
    const sessionId =
      typeof parsed.sessionId === "string" ? parsed.sessionId : undefined;
    const provider =
      typeof parsed.provider === "string" ? parsed.provider : undefined;
    return { sessionId, provider };
  } catch {
    return {};
  }
}

/** @deprecated Use loadSessionMeta() */
export function loadSessionId(): string | undefined {
  return loadSessionMeta().sessionId;
}

export function persistSessionId(sessionId: string, provider?: string): void {
  mkdirSync(dirname(SESSION_PATH), { recursive: true });
  writeFileSync(
    SESSION_PATH,
    JSON.stringify(
      { sessionId, provider, savedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
}

function transcriptPath(sessionId: string): string {
  return join(TRANSCRIPTS_DIR, `${sessionId}.json`);
}

export function loadGeminiHistory(sessionId: string): Content[] | undefined {
  const path = transcriptPath(sessionId);
  if (!existsSync(path)) {
    return undefined;
  }
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed.contents)) {
    throw new Error(`Invalid Gemini transcript for session ${sessionId}`);
  }
  return parsed.contents as Content[];
}

export function persistGeminiHistory(
  sessionId: string,
  contents: Content[],
): void {
  const path = transcriptPath(sessionId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      { sessionId, savedAt: new Date().toISOString(), contents },
      null,
      2,
    ),
  );
}
