import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runAgent, loadLlmConfig, formatLlmLabel } from "./agent.ts";
import { loadExternalMcpConfig } from "./config/mcp.ts";
import { tryListExternalToolNames } from "./mcp/external-client.ts";
import { loadSessionMeta, persistSessionId } from "./sessions.ts";

async function main(): Promise<void> {
  const config = loadLlmConfig();
  const llmLabel = formatLlmLabel(config);
  const externalMcp = loadExternalMcpConfig();

  const isNewSession = process.argv.includes("--new");
  const sessionMeta = isNewSession ? {} : loadSessionMeta();
  let sessionId = sessionMeta.sessionId;

  if (
    sessionId &&
    sessionMeta.provider &&
    sessionMeta.provider !== config.provider
  ) {
    console.log(
      `Provider changed (${sessionMeta.provider} → ${config.provider}); starting fresh.`,
    );
    sessionId = undefined;
  }

  if (sessionId) {
    console.log(
      `personal-agent — ${llmLabel} — resuming session ${sessionId.slice(0, 8)}…`,
    );
  } else {
    console.log(`personal-agent — ${llmLabel} — new session`);
  }

  if (externalMcp) {
    const toolNames = await tryListExternalToolNames();
    if (toolNames) {
      console.log(
        `external MCP (${externalMcp.serverName}): ${toolNames.join(", ")}`,
      );
    } else {
      console.warn(
        `warning: could not reach external MCP at ${externalMcp.url}`,
      );
    }
  }

  console.log("─────────────────────────────────────");
  console.log("(run with --new to start a fresh session)");

  const rl = readline.createInterface({ input: stdin, output: stdout });

  while (true) {
    const input = (await rl.question("\nyou › ")).trim();

    if (!input) continue;
    if (input === "exit" || input === "quit") break;

    try {
      const result = await runAgent(input, sessionId);
      sessionId = result.sessionId;
      persistSessionId(sessionId, config.provider);
      console.log(`\nagent › ${result.reply}`);
    } catch (err) {
      console.error("\nerror:", err instanceof Error ? err.message : err);
    }
  }

  rl.close();
  console.log("\nbye.");
}

main();
