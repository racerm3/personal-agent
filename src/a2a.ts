import { randomUUID } from "node:crypto";
import { runAgent, loadLlmConfig, formatLlmLabel } from "./agent.ts";

// Minimal A2A protocol types — see https://a2a-protocol.org/
type TextPart = { kind: "text"; text: string };
type Part = TextPart;

type Message = {
  kind: "message";
  messageId: string;
  role: "user" | "agent";
  parts: Part[];
  contextId?: string;
  taskId?: string;
};

type TaskStatus = {
  state: "submitted" | "working" | "completed" | "failed" | "canceled";
  timestamp: string;
  message?: Message;
};

type Task = {
  kind: "task";
  id: string;
  contextId: string;
  status: TaskStatus;
  history: Message[];
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const tasks = new Map<string, Task>();

function nowIso(): string {
  return new Date().toISOString();
}

function extractText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (p): p is TextPart =>
        !!p &&
        typeof p === "object" &&
        (p as { kind?: unknown }).kind === "text" &&
        typeof (p as { text?: unknown }).text === "string",
    )
    .map((p) => p.text)
    .join("\n")
    .trim();
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleMessageSend(
  params: unknown,
): Promise<{ task: Task; agentMessage: Message }> {
  const p = (params ?? {}) as { message?: unknown };
  const msg = p.message as
    | { parts?: unknown; contextId?: unknown; messageId?: unknown }
    | undefined;
  if (!msg) throw new Error("params.message is required");

  const text = extractText(msg.parts);
  if (!text) throw new Error("message must contain a non-empty text part");

  const contextId =
    typeof msg.contextId === "string" && msg.contextId
      ? msg.contextId
      : undefined;

  const taskId = randomUUID();
  const userMessage: Message = {
    kind: "message",
    messageId:
      typeof msg.messageId === "string" && msg.messageId
        ? msg.messageId
        : randomUUID(),
    role: "user",
    parts: [{ kind: "text", text }],
    contextId,
    taskId,
  };

  const task: Task = {
    kind: "task",
    id: taskId,
    contextId: contextId ?? "",
    status: { state: "working", timestamp: nowIso() },
    history: [userMessage],
  };
  tasks.set(taskId, task);

  try {
    const result = await runAgent(text, contextId);
    const agentMessage: Message = {
      kind: "message",
      messageId: randomUUID(),
      role: "agent",
      parts: [{ kind: "text", text: result.reply }],
      contextId: result.sessionId,
      taskId,
    };
    task.contextId = result.sessionId;
    task.history.push(agentMessage);
    task.status = {
      state: "completed",
      timestamp: nowIso(),
      message: agentMessage,
    };
    userMessage.contextId = result.sessionId;
    return { task, agentMessage };
  } catch (err) {
    const errMsg: Message = {
      kind: "message",
      messageId: randomUUID(),
      role: "agent",
      parts: [
        { kind: "text", text: err instanceof Error ? err.message : String(err) },
      ],
      contextId: task.contextId,
      taskId,
    };
    task.history.push(errMsg);
    task.status = { state: "failed", timestamp: nowIso(), message: errMsg };
    throw err;
  }
}

function handleTasksGet(params: unknown): Task {
  const p = (params ?? {}) as { id?: unknown };
  if (typeof p.id !== "string" || !p.id) throw new Error("params.id is required");
  const task = tasks.get(p.id);
  if (!task) throw new Error(`task not found: ${p.id}`);
  return task;
}

function handleTasksCancel(params: unknown): Task {
  // No long-running tasks yet — message/send completes synchronously.
  // Accept the call so clients don't error, but report current state.
  const task = handleTasksGet(params);
  if (task.status.state === "working") {
    task.status = { state: "canceled", timestamp: nowIso() };
  }
  return task;
}

export async function dispatchJsonRpc(
  raw: string,
): Promise<JsonRpcResponse | JsonRpcResponse[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const handle = async (req: unknown): Promise<JsonRpcResponse> => {
    if (!req || typeof req !== "object") {
      return rpcError(null, -32600, "Invalid Request");
    }
    const r = req as JsonRpcRequest;
    const id = r.id ?? null;
    if (r.jsonrpc !== "2.0" || typeof r.method !== "string") {
      return rpcError(id, -32600, "Invalid Request");
    }

    try {
      switch (r.method) {
        case "message/send": {
          const { task, agentMessage } = await handleMessageSend(r.params);
          // A2A allows returning either a Task or a Message; we return the
          // final agent Message for simple synchronous interactions and
          // include the task via the message's taskId for correlation.
          void task;
          return { jsonrpc: "2.0", id, result: agentMessage };
        }
        case "tasks/get":
          return { jsonrpc: "2.0", id, result: handleTasksGet(r.params) };
        case "tasks/cancel":
          return { jsonrpc: "2.0", id, result: handleTasksCancel(r.params) };
        default:
          return rpcError(id, -32601, `Method not found: ${r.method}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return rpcError(id, -32000, message);
    }
  };

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return rpcError(null, -32600, "Invalid Request");
    return Promise.all(parsed.map(handle));
  }
  return handle(parsed);
}

export function buildAgentCard(baseUrl: string): unknown {
  const config = loadLlmConfig();
  return {
    protocolVersion: "0.3.0",
    name: "personal-agent",
    description: `Personal AI agent (${formatLlmLabel(config)})`,
    version: "0.2.0",
    url: `${baseUrl}/a2a`,
    preferredTransport: "JSONRPC",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "chat",
        name: "Chat",
        description:
          "General-purpose conversational agent with persistent sessions and tool access.",
        tags: ["chat", "assistant"],
      },
    ],
  };
}
