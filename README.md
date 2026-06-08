# Personal Agent

A personal AI agent built step-by-step with the [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk) and optional native [Google Gemini](https://ai.google.dev/) support.
Companion code for a blog series — each post is a git tag.

## Posts

- [post-01-hello-agent](./blog/POST-01.md) — the simplest possible agent loop
- [post-02-memory](./blog/POST-02.md) — giving the agent memory with SQLite + FTS5 ← **you are here**

## Requirements

- Node.js 20+
- An API key for your chosen provider:
  - **Anthropic** (default): [console.anthropic.com](https://console.anthropic.com/)
  - **Gemini**: [Google AI Studio](https://aistudio.google.com/apikey)

## Setup

```bash
git clone https://github.com/bgorkem/personal-agent
cd personal-agent
npm install
cp .env.example .env
# edit .env — set LLM_PROVIDER and the matching API key
```

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `anthropic` | `anthropic` or `gemini` |
| `API_KEY` | — | API key for the active provider (Anthropic or Gemini) |
| `LLM_MODEL` | provider default | Optional model override |
| `LLM_MAX_TURNS` | `10` | Max agent loop iterations per message |
| `EXTERNAL_MCP_URL` | — | Remote MCP endpoint; leave empty to disable |
| `EXTERNAL_MCP_SERVER_NAME` | `hello` | Server name prefix for Anthropic tool names |

**Switch to Gemini:**

```env
LLM_PROVIDER=gemini
API_KEY=your_gemini_key_here
# LLM_MODEL=gemini-2.5-flash   # optional
```

Run with `--new` after switching providers so session state starts clean.

### External MCP (hello-mcp)

Connect a remote MCP server as global tools on both providers:

```env
EXTERNAL_MCP_URL=https://hello-mcp-i2gdpj.49v8i7.usa-e2.cloudhub.io/mcp
EXTERNAL_MCP_SERVER_NAME=hello
```

- **Anthropic**: registered via Claude Agent SDK HTTP transport (`mcp__hello__*` tools)
- **Gemini**: bridged via `@modelcontextprotocol/sdk` client (tools discovered at runtime)
- No authentication required for the default hello-mcp endpoint
- Leave `EXTERNAL_MCP_URL` empty to disable external tools (memory-only mode)

### Provider differences

| Feature | Anthropic | Gemini |
|---------|-----------|--------|
| Memory tools (save / search / list) | Yes | Yes |
| External MCP tools | Yes (SDK HTTP) | Yes (MCP client bridge) |
| Built-in web search & fetch | Yes | No |
| Session transcripts | SDK-managed (`~/.claude/projects/`) | Local (`data/transcripts/`) |

## Run

```bash
npm start       # CLI (readline)
npm run web     # Web UI at http://localhost:3000 (set WEB_PORT to override)
```

Try things like:

- `remember that I prefer Earl Grey over coffee`
- `what do I like to drink?`
- `what have we talked about lately?`

The memory file lives at `data/agent.db` and is gitignored. Delete it any time to start fresh.

## Deploy to Heroku

```bash
heroku create your-agent-name
heroku config:set LLM_PROVIDER=anthropic|gemini
heroku config:set API_KEY=<LLM API Key>
# optional:
# heroku config:set EXTERNAL_MCP_URL=...
# heroku config:set EXTERNAL_MCP_SERVER_NAME=...
git push heroku main
heroku open
```

The included `Procfile` runs `npm run web`, and Heroku injects `PORT` automatically. `app.json` lists the env vars for one-click "Deploy to Heroku" buttons or `heroku create --manifest`.

**Caveat — ephemeral filesystem:** Heroku dynos restart daily and lose anything written to `data/`. That means the memory SQLite (`data/agent.db`) and Gemini transcripts (`data/transcripts/`) reset on each restart. For persistent memory, swap in a Heroku Postgres-backed store or attach a managed volume.

## What's in this version

- `src/agent.ts` — provider router (`runAgent`)
- `src/config/llm.ts` — `.env` configuration
- `src/providers/anthropic.ts` — Claude Agent SDK harness
- `src/providers/gemini.ts` — native Gemini agent loop
- `src/memory.ts` — SQLite + FTS5 schema and CRUD functions
- `src/tools/memory-core.ts` — shared memory tool logic
- `src/tools/memory-tools.ts` — Anthropic MCP tool wrappers
- `src/tools/memory-gemini.ts` — Gemini memory function declarations
- `src/tools/gemini-tools.ts` — unified Gemini tool loader (memory + external MCP)
- `src/mcp/external-client.ts` — MCP client for Gemini external tool bridge
- `src/config/mcp.ts` — external MCP `.env` configuration
- `src/cli.ts` — readline loop

## License

MIT
