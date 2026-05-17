# Building a Personal AI Agent, Part 1: Hello, Agent

*A blog series where I build a personal AI agent from scratch in Node.js, one capability at a time. By the end we'll have something with memory, scheduled tasks, web browsing, and pluggable skills — running on whatever hardware you like, including a £80 Raspberry Pi in my case.*

> *This post was written with the assistance of an AI writing program (Claude). The ideas, code, and technical decisions are mine; AI helped structure and clarify the prose.*

---

## Why I'm building this

I've spent the last few months tinkering with AI agents. OpenClaw running on a Raspberry Pi, Claude Code as a daily driver, half a dozen MCP servers wired up to my Obsidian vault. Useful stuff, but every off-the-shelf tool eventually hits a wall: it doesn't quite remember what I want it to remember, it doesn't schedule things on its own, it doesn't learn the specific skills I keep teaching it.

So I'm going to build my own. Not because the world needs another agent framework, but because building one is the fastest way to actually understand how agents work, and writing it down forces me to explain the parts I'd otherwise hand-wave.

This is post 1. The goal is small: get the simplest possible agent talking back in a terminal, and understand what's actually happening when it does.

Across the series we'll add:

- Memory that persists across sessions (post 2)
- Sessions that resume where we left off (post 3)
- Scheduled tasks so the agent can act on its own clock (post 4)
- Skills — declarative capabilities the agent loads on demand (post 5)
- Transports — a web UI and a Telegram bot (post 6)
- Deployment — running it 24/7 on a Raspberry Pi (post 7)

Every post ships working code. The repo is at [github.com/bgorkem/personal-agent](https://github.com/bgorkem/personal-agent), and each post has a git tag — `git checkout post-01-hello-agent` and play.

---

## First, a confusion to clear up

When I tell people I'm building an agent with "Claude", they assume one of two things: I'm using Claude Code (the CLI coding tool), or I'm calling the Anthropic Messages API directly. Neither is quite right. I'm using the **Claude Agent SDK**, which is a distinct third thing, and the difference matters because most "build an agent" tutorials online either skip past it or conflate it with one of the other two.

Here's the actual landscape:

**Anthropic API** is the raw `/v1/messages` HTTP endpoint. Maximum control — you build the agent loop yourself, handle streaming, retries, tool calling, the lot. Powerful but a lot of plumbing.

**Claude Code** is a standalone CLI that uses the SDK internally to edit your codebase. It's an end product. Use it when you want a coding assistant, not when you want to build one.

**Claude Agent SDK** is an npm package, `@anthropic-ai/claude-agent-sdk`. It gives you the same runtime that powers Claude Code, but as a library you can `import` into your own programs. This is the row we're on.

Practical implication: Claude Code is optional in this series. You can use Claude Code to *write* the code we'll be writing, or VS Code with Copilot, or just your favourite editor. The agent we're *building* doesn't need Claude Code to run — it's a plain Node.js process.

---

## What is an agent, really?

An agent is a loop:

1. User sends a message
2. Model decides: respond, or call a tool?
3. If tool: run it, send the result back to the model, go to step 2
4. If respond: print it, wait for next user message

That's it. A chatbot is step 1 → step 4. An agent is the same thing with steps 2 and 3 in the middle.

The interesting part is that step 2 is autonomous. The model decides on its own which tool to call, when, with what arguments, and whether to call another one based on the result. Your job is to give it a good set of tools, give it enough context to use them well, and stay out of its way.

When you write this loop yourself — which I've done; it takes about 400 lines of TypeScript — you spend most of your time wrangling JSON shapes, retrying on errors, and handling streaming. The Agent SDK does all of that for you. What's left is the interesting part: deciding which tools your agent gets and how it uses them.

---

## The simplest thing that proves it works

Let's build it. I'm using:

- Node.js 20+ with TypeScript
- tsx to run TypeScript directly, no build step
- `@anthropic-ai/claude-agent-sdk` — the only dependency that matters

Here's the entire `package.json`:

```json
{
  "name": "personal-agent",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/cli.ts"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

Two files of actual code. First, the agent core:

```typescript
// src/agent.ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import "dotenv/config";

export async function runAgent(userMessage: string): Promise<string> {
  const chunks: string[] = [];

  for await (const message of query({
    prompt: userMessage,
    options: {
      allowedTools: ["WebSearch", "WebFetch"],
      permissionMode: "bypassPermissions",
      maxTurns: 10,
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      chunks.push(message.result);
    }
  }

  return chunks.join("\n").trim();
}
```

That's the whole agent. Let's go through it.

`query()` is the SDK's main entry point. You give it a prompt and some options, and you get back an async iterable. Each item in that iterable is a *message* — could be a tool call, a tool result, the model's thinking, or the final answer. The SDK is streaming the entire agent loop to you as it happens.

`allowedTools: ["WebSearch", "WebFetch"]` is where we tell the SDK which built-in tools the agent can use. The SDK ships with quite a few — file ops, shell commands, todo tracking — but for this first version I only want web tools. The agent can look things up online but can't touch our filesystem.

`permissionMode: "bypassPermissions"` skips the "are you sure?" prompts that the SDK shows by default. We're on our own machine; we trust it. We'll revisit this in a later post when we wire up a Telegram transport and trust matters more.

`maxTurns: 10` caps how many tool-call cycles can happen before the agent has to give us an answer. A safety net.

The loop at the bottom collects every `result` message and joins them. That's our reply.

Now the CLI transport:

```typescript
// src/cli.ts
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runAgent } from "./agent.ts";

const rl = readline.createInterface({ input: stdin, output: stdout });

console.log("personal-agent — type 'exit' to quit");
console.log("─────────────────────────────────────");

while (true) {
  const input = (await rl.question("\nyou › ")).trim();
  if (!input) continue;
  if (input === "exit" || input === "quit") break;

  try {
    const reply = await runAgent(input);
    console.log(`\nagent › ${reply}`);
  } catch (err) {
    console.error("\nerror:", err instanceof Error ? err.message : err);
  }
}

rl.close();
```

Twenty lines. No framework, no router, no abstractions. We'll add a web UI and a Telegram bot in later posts, but the structure stays the same: each transport is a thin shell that calls `runAgent()`. The brain lives in one place.

---

## Running it

```bash
git clone https://github.com/bgorkem/personal-agent
cd personal-agent
npm install
cp .env.example .env
# paste your Anthropic API key into .env
npm start
```

You'll get a prompt:

```
personal-agent — type 'exit' to quit
─────────────────────────────────────

you › what's the weather in london right now?

agent › Based on a quick check, London is currently around 12°C with light
rain expected through the evening. The Met Office forecast shows...
```

Behind the scenes the agent decided "I don't know the current weather; I should use WebSearch", made the call, got results, and synthesised an answer. We didn't write any of that logic. The SDK did. We just told it which tools were available.

---

## What about cost?

Honest numbers: a conversation like the one above costs roughly 1–2 US cents. A heavy day of personal use is well under a dollar. Top up $5 of credit at the [Anthropic console](https://console.anthropic.com/) and you'll have weeks of agent before you need to think about it again.

Worth noting: the Agent SDK only works with Anthropic models. You *can* point it at OpenAI or Gemini via a proxy like LiteLLM, but the tool-calling fidelity drops, and I want to learn how a well-behaved agent feels before we start swapping providers. We'll revisit multi-model in a later post.

---

## What we deliberately didn't do

A surprising amount of complexity comes from over-engineering early. Things we explicitly *don't* have yet:

- **Memory.** The agent forgets everything between messages right now. Each `runAgent()` call is a fresh start. That's deliberate — memory is post 2, and doing it well needs its own discussion.
- **Sessions.** Different from memory. Within a single conversation the agent does have context, but only because we're making a single SDK call per user input. We'll fix that in post 3.
- **A database.** Don't need one yet.
- **A web server.** Don't need one yet.
- **A framework.** Hono, Fastify, NestJS — none of them. The whole project is `npm start`. We'll add a transport later when there's something to transport to.

If you came here looking for "the right way to structure an agent project", the answer for post 1 is: two files, four dependencies, run it from the terminal. Add complexity when it pays for itself.

---

## What's next

Post 2: **giving the agent memory.** We'll add a tiny SQLite database, expose two custom tools (`save_memory` and `search_memory`), and watch the agent decide on its own when to use them. Spoiler: we won't reach for a vector database. SQLite's built-in full-text search is enough to get surprisingly far, and starting simple makes it obvious *when* you actually need embeddings.

Code for this post is tagged `post-01-hello-agent` in the [repo](https://github.com/bgorkem/personal-agent). See you in the next one.

---

*If you spot something I got wrong or you'd do differently, leave a comment. I'd rather get corrected publicly than ship bad ideas. The series is being written as I build, so feedback genuinely shapes what comes next.*
