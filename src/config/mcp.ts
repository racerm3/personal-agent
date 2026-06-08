import "dotenv/config";

export type ExternalMcpConfig = {
  url: string;
  serverName: string;
};

const DEFAULT_SERVER_NAME = "hello";

export function loadExternalMcpConfig(): ExternalMcpConfig | null {
  const url = process.env.EXTERNAL_MCP_URL?.trim();
  if (!url) {
    return null;
  }

  const serverName =
    process.env.EXTERNAL_MCP_SERVER_NAME?.trim() || DEFAULT_SERVER_NAME;

  return { url, serverName };
}
