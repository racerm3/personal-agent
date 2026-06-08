import "dotenv/config";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runAgent, loadLlmConfig, formatLlmLabel } from "./agent.ts";
import { loadExternalMcpConfig } from "./config/mcp.ts";
import { tryListExternalToolNames } from "./mcp/external-client.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, "..", "public");
const PORT = Number(process.env.PORT ?? process.env.WEB_PORT ?? 3000);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function handleChat(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let body: { message?: unknown; sessionId?: unknown };
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    sendJson(res, 400, { error: "message is required" });
    return;
  }
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId
      ? body.sessionId
      : undefined;

  try {
    const result = await runAgent(message, sessionId);
    sendJson(res, 200, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("agent error:", msg);
    sendJson(res, 500, { error: msg });
  }
}

async function handleIndex(res: ServerResponse): Promise<void> {
  try {
    const html = await readFile(resolve(PUBLIC_DIR, "index.html"));
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-length": html.byteLength,
    });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("failed to load index.html: " + (err instanceof Error ? err.message : String(err)));
  }
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && (url === "/" || url === "/index.html")) {
    await handleIndex(res);
    return;
  }

  if (method === "GET" && url === "/api/info") {
    const config = loadLlmConfig();
    sendJson(res, 200, { label: formatLlmLabel(config) });
    return;
  }

  if (method === "POST" && url === "/api/chat") {
    await handleChat(req, res);
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, async () => {
  const config = loadLlmConfig();
  console.log(
    `personal-agent web — ${formatLlmLabel(config)} — http://localhost:${PORT}`,
  );

  const externalMcp = loadExternalMcpConfig();
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
});
