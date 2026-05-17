import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SESSION_PATH = process.env.AGENT_SESSION_PATH ?? "data/session.json";

export function loadSessionId(): string | undefined {
  try {
    const { sessionId } = JSON.parse(readFileSync(SESSION_PATH, "utf8"));
    return typeof sessionId === "string" ? sessionId : undefined;
  } catch {
    return undefined;
  }
}

export function persistSessionId(sessionId: string): void {
  mkdirSync(dirname(SESSION_PATH), { recursive: true });
  writeFileSync(
    SESSION_PATH,
    JSON.stringify({ sessionId, savedAt: new Date().toISOString() }, null, 2),
  );
}
