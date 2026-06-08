import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadExternalMcpConfig, type ExternalMcpConfig } from "../config/mcp.ts";

export type ExternalMcpTool = {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
    [key: string]: unknown;
  };
};

let client: Client | null = null;
let transport: StreamableHTTPClientTransport | null = null;
let cachedTools: ExternalMcpTool[] | null = null;
let connectedUrl: string | null = null;

function serializeToolContent(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .map((part) => {
      if (part.type === "text" && part.text) {
        return part.text;
      }
      return JSON.stringify(part);
    })
    .join("\n");
}

async function ensureConnected(config: ExternalMcpConfig): Promise<Client> {
  if (client && connectedUrl === config.url) {
    return client;
  }

  await closeExternalMcpClient();

  const nextClient = new Client({ name: "personal-agent", version: "0.2.0" });
  const nextTransport = new StreamableHTTPClientTransport(new URL(config.url));

  try {
    await nextClient.connect(nextTransport);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to connect to external MCP at ${config.url}: ${message}`,
    );
  }

  client = nextClient;
  transport = nextTransport;
  connectedUrl = config.url;
  cachedTools = null;
  return nextClient;
}

export async function listExternalTools(): Promise<ExternalMcpTool[]> {
  const config = loadExternalMcpConfig();
  if (!config) {
    return [];
  }

  if (cachedTools) {
    return cachedTools;
  }

  const activeClient = await ensureConnected(config);
  const allTools: ExternalMcpTool[] = [];
  let cursor: string | undefined;

  do {
    const page = await activeClient.listTools({ cursor });
    allTools.push(...(page.tools as ExternalMcpTool[]));
    cursor = page.nextCursor;
  } while (cursor);

  cachedTools = allTools;
  return allTools;
}

export async function callExternalTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: string }> {
  const config = loadExternalMcpConfig();
  if (!config) {
    throw new Error(
      "External MCP is not configured. Set EXTERNAL_MCP_URL in .env.",
    );
  }

  const activeClient = await ensureConnected(config);
  const result = await activeClient.callTool({ name, arguments: args });
  const text = serializeToolContent(
    result.content as Array<{ type: string; text?: string }>,
  );

  if (result.isError) {
    return { result: text || `Tool "${name}" failed.` };
  }

  return { result: text || "(no output)" };
}

export async function tryListExternalToolNames(): Promise<string[] | null> {
  try {
    const tools = await listExternalTools();
    return tools.map((tool) => tool.name);
  } catch {
    return null;
  }
}

export async function closeExternalMcpClient(): Promise<void> {
  if (transport) {
    await transport.close().catch(() => {});
  }
  client = null;
  transport = null;
  cachedTools = null;
  connectedUrl = null;
}
