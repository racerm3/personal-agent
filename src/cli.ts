import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runAgent } from "./agent.ts";
import { loadSessionId, persistSessionId } from "./sessions.ts";

const isNewSession = process.argv.includes("--new");
let sessionId = isNewSession ? undefined : loadSessionId();

const rl = readline.createInterface({ input: stdin, output: stdout });

if (sessionId) {
  console.log(`personal-agent — resuming session ${sessionId.slice(0, 8)}…`);
} else {
  console.log("personal-agent — new session");
}
console.log("─────────────────────────────────────");
console.log("(run with --new to start a fresh session)");

while (true) {
  const input = (await rl.question("\nyou › ")).trim();

  if (!input) continue;
  if (input === "exit" || input === "quit") break;

  try {
    const result = await runAgent(input, sessionId);
    sessionId = result.sessionId;
    persistSessionId(sessionId);
    console.log(`\nagent › ${result.reply}`);
  } catch (err) {
    console.error("\nerror:", err instanceof Error ? err.message : err);
  }
}

rl.close();
console.log("\nbye.");