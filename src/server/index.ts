import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyReply } from "fastify";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AnthropicSseAccumulator,
  extractRequestMessages,
  extractResponseMessages,
  redactHeaders,
  requestSummary,
  safeJsonParse,
  usageFromResponse
} from "./parser.js";
import {
  agentDefinitions,
  disableAgentIntegration,
  enableAgentIntegration,
  getAgentIntegration,
  normalizeAgentSettingsPath
} from "./agentIntegrations.js";
import {
  disableClaudeIntegration,
  enableClaudeIntegration,
  getClaudeIntegrationStatus,
  normalizeClaudeSettingsPath
} from "./claudeSettings.js";
import { Storage } from "./storage.js";
import type { ProviderConfig } from "./types.js";

const proxyPort = Number(process.env.AGENT_CHARLES_PROXY_PORT ?? 4317);
const proxyUrl = `http://127.0.0.1:${proxyPort}`;
const storage = new Storage();
const app = Fastify({ logger: true, bodyLimit: 64 * 1024 * 1024 });

await app.register(cors, { origin: true });

app.get("/api/health", async () => ({
  ok: true,
  proxyUrl,
  dbPath: storage.path
}));

app.get("/api/provider", async () => publicProvider(storage.getProviderConfig()));

app.put<{ Body: Partial<ProviderConfig> }>("/api/provider", async (request) => {
  const current = storage.getProviderConfig();
  const next: ProviderConfig = {
    ...current,
    ...request.body,
    baseUrl: normalizeBaseUrl(request.body.baseUrl ?? current.baseUrl),
    apiKey: request.body.apiKey && request.body.apiKey !== "********" ? request.body.apiKey : current.apiKey,
    extraHeaders: request.body.extraHeaders ?? current.extraHeaders ?? {}
  };
  storage.saveProviderConfig(next);
  return publicProvider(next);
});

app.get("/api/claude-code/status", async () => getClaudeIntegrationStatus(proxyUrl, storage.getClaudeSettingsPath()));
app.put<{ Body: { settingsPath?: string } }>("/api/claude-code/settings-path", async (request) => {
  const settingsPath = normalizeClaudeSettingsPath(request.body.settingsPath ?? "");
  storage.saveClaudeSettingsPath(settingsPath);
  return getClaudeIntegrationStatus(proxyUrl, settingsPath);
});
app.post("/api/claude-code/enable", async () => enableClaudeIntegration(proxyUrl, storage.getClaudeSettingsPath()));
app.post("/api/claude-code/disable", async () => disableClaudeIntegration(proxyUrl, storage.getClaudeSettingsPath()));

app.get("/api/agents", async () => agentDefinitions.map((agent) =>
  getAgentIntegration(agent.id, proxyUrl, storage.getAgentSettingsPath(agent.id))
));
app.put<{ Params: { id: string }; Body: { settingsPath?: string } }>("/api/agents/:id/settings-path", async (request) => {
  const settingsPath = normalizeAgentSettingsPath(request.params.id, request.body.settingsPath ?? "");
  storage.saveAgentSettingsPath(request.params.id, settingsPath);
  return getAgentIntegration(request.params.id, proxyUrl, settingsPath);
});
app.post<{ Params: { id: string } }>("/api/agents/:id/start", async (request) =>
  enableAgentIntegration(request.params.id, proxyUrl, storage.getAgentSettingsPath(request.params.id))
);
app.post<{ Params: { id: string } }>("/api/agents/:id/stop", async (request) =>
  disableAgentIntegration(request.params.id, proxyUrl, storage.getAgentSettingsPath(request.params.id))
);

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.code(400).send({ error: error.message });
});

app.get("/api/captures", async () => storage.listCaptures());
app.get<{ Params: { id: string } }>("/api/captures/:id", async (request, reply) => {
  const capture = storage.getCapture(request.params.id);
  if (!capture) return reply.code(404).send({ error: "Capture not found" });
  return capture;
});
app.delete("/api/captures", async () => {
  storage.clearCaptures();
  return { ok: true };
});

app.all("/v1/*", async (request, reply) => {
  const startedMs = Date.now();
  const id = crypto.randomUUID();
  const path = request.url;
  const method = request.method;
  const bodyText = bodyToText(request.body);
  const bodyBuffer = Buffer.from(bodyText);
  const requestJson = safeJsonParse(bodyText);
  const requestRecord = isRecord(requestJson) ? requestJson : {};
  const stream = requestRecord.stream === true;
  const requestMessages = extractRequestMessages(requestJson);
  const model = typeof requestRecord.model === "string" ? requestRecord.model : null;
  const agent = detectAgent(request.headers, bodyText);

  storage.createCapture({
    id,
    method,
    path,
    model,
    agent,
    stream,
    requestJson: bodyText,
    requestHeadersJson: JSON.stringify(redactHeaders(request.headers), null, 2),
    summary: requestSummary(requestJson)
  });
  storage.addMessages(id, requestMessages);

  const provider = storage.getProviderConfig();
  const translation = openAiChatCompletionToAnthropic(path, requestRecord, provider);
  const upstreamPath = translation?.path ?? path;
  const upstreamBodyText = translation ? JSON.stringify(translation.body) : bodyText;
  const upstreamBodyBuffer = Buffer.from(upstreamBodyText);
  const targetUrl = upstreamUrl(provider.baseUrl, upstreamPath);
  if (!provider.apiKey) {
    const message = "Provider API key is not configured in Agent Charles UI.";
    storage.finishCapture({
      id,
      status: 502,
      startedMs,
      error: message,
      responseJson: JSON.stringify({ error: message }, null, 2)
    });
    return reply.code(502).send({ error: message });
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method,
      headers: buildUpstreamHeaders(request.headers, provider, upstreamBodyBuffer.length),
      body: method === "GET" || method === "HEAD" ? undefined : upstreamBodyBuffer as unknown as BodyInit
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    storage.finishCapture({
      id,
      status: 502,
      startedMs,
      error: message,
      responseJson: JSON.stringify({ error: message, upstreamUrl: targetUrl }, null, 2)
    });
    return reply.code(502).send({ error: message });
  }

  const responseHeadersJson = JSON.stringify(headersToObject(upstreamResponse.headers), null, 2);
  const contentType = upstreamResponse.headers.get("content-type") ?? "";

  if (translation && contentType.includes("text/event-stream")) {
    await proxyOpenAiChatCompletionStream(reply, upstreamResponse, {
      id,
      startedMs,
      responseHeadersJson,
      requestMessageCount: requestMessages.length,
      model: translation.responseModel
    });
    return;
  }

  if (contentType.includes("text/event-stream")) {
    await proxyStream(reply, upstreamResponse, {
      id,
      startedMs,
      responseHeadersJson,
      requestMessageCount: requestMessages.length
    });
    return;
  }

  const responseText = await upstreamResponse.text();
  const translatedResponse = translation
    ? JSON.stringify(anthropicToOpenAiChatCompletion(safeJsonParse(responseText), translation.responseModel), null, 2)
    : responseText;
  const responseJson = safeJsonParse(translatedResponse);
  storage.addMessages(id, extractResponseMessages(responseJson, requestMessages.length));
  const usage = usageFromResponse(responseJson);
  storage.finishCapture({
    id,
    status: upstreamResponse.status,
    startedMs,
    responseJson: translatedResponse,
    responseHeadersJson,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens
  });

  reply.code(upstreamResponse.status);
  if (translation) {
    reply.header("content-type", "application/json");
    return reply.send(translatedResponse);
  }
  copyHeaders(reply, upstreamResponse.headers);
  return reply.send(responseText);
});

const webDist = join(dirname(fileURLToPath(import.meta.url)), "../web");
if (existsSync(webDist)) {
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: "/"
  });
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith("/api") || request.raw.url?.startsWith("/v1")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}

await app.listen({ host: "127.0.0.1", port: proxyPort });
console.log(`Agent Charles proxy: ${proxyUrl}`);
console.log(`Agent Charles UI:    ${proxyUrl}`);

function publicProvider(config: ProviderConfig) {
  return {
    ...config,
    apiKey: config.apiKey ? "********" : ""
  };
}

function upstreamUrl(baseUrl: string, path: string) {
  const base = normalizeBaseUrl(baseUrl);
  if (base.endsWith("/v1") && path.startsWith("/v1/")) {
    return `${base}${path.slice(3)}`;
  }
  return `${base}${path}`;
}

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;
}

function buildUpstreamHeaders(
  incoming: Record<string, string | string[] | undefined>,
  provider: ProviderConfig,
  bodyLength: number
) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming)) {
    const lower = key.toLowerCase();
    if (["host", "content-length", "x-api-key", "api-key", "authorization", "proxy-authorization", "connection", "accept-encoding"].includes(lower)) continue;
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== undefined) headers.set(key, value);
  }
  headers.set("content-length", String(bodyLength));
  if (isAnthropicBaseUrl(provider.baseUrl)) {
    headers.set("anthropic-version", provider.apiVersion || headers.get("anthropic-version") || "2023-06-01");
  }
  if (provider.authHeader === "authorization") {
    headers.set("authorization", `Bearer ${provider.apiKey}`);
  } else {
    headers.set("x-api-key", provider.apiKey);
  }
  for (const [key, value] of Object.entries(provider.extraHeaders ?? {})) {
    if (key.trim() && value.trim()) headers.set(key.trim(), value.trim());
  }
  return headers;
}

function openAiChatCompletionToAnthropic(path: string, body: Record<string, unknown>, provider: ProviderConfig) {
  const pathname = path.split("?")[0];
  if (pathname !== "/v1/chat/completions" || !isAnthropicBaseUrl(provider.baseUrl)) return null;
  const requestedModel = typeof body.model === "string" ? body.model : "";
  const responseModel = provider.defaultModel || requestedModel.replace(/^agent-charles\//, "") || requestedModel;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const system: string[] = [];
  const anthropicMessages: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    if (!isRecord(message)) continue;
    const role = typeof message.role === "string" ? message.role : "user";
    if (role === "system" || role === "developer") {
      const text = openAiContentToText(message.content);
      if (text) system.push(text);
      continue;
    }
    if (role === "tool") {
      anthropicMessages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: typeof message.tool_call_id === "string" ? message.tool_call_id : crypto.randomUUID(),
          content: openAiContentToText(message.content)
        }]
      });
      continue;
    }
    const content = openAiMessageToAnthropicContent(message);
    if (content.length) {
      anthropicMessages.push({ role: role === "assistant" ? "assistant" : "user", content });
    }
  }

  const anthropicBody: Record<string, unknown> = {
    model: responseModel,
    max_tokens: numberOrDefault(body.max_tokens, numberOrDefault(body.max_completion_tokens, 4096)),
    messages: anthropicMessages,
    stream: body.stream === true
  };
  if (system.length) anthropicBody.system = system.join("\n\n");
  if (typeof body.temperature === "number") anthropicBody.temperature = body.temperature;
  if (typeof body.top_p === "number") anthropicBody.top_p = body.top_p;
  if (Array.isArray(body.stop)) anthropicBody.stop_sequences = body.stop;
  if (typeof body.stop === "string") anthropicBody.stop_sequences = [body.stop];
  if (Array.isArray(body.tools)) {
    const tools = body.tools.map(openAiToolToAnthropic).filter(Boolean);
    if (tools.length) anthropicBody.tools = tools;
  }

  return { path: "/v1/messages", body: anthropicBody, responseModel };
}

function openAiMessageToAnthropicContent(message: Record<string, unknown>) {
  const content: Array<Record<string, unknown>> = [];
  const text = openAiContentToText(message.content);
  if (text) content.push({ type: "text", text });
  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      if (!isRecord(call) || !isRecord(call.function)) continue;
      content.push({
        type: "tool_use",
        id: typeof call.id === "string" ? call.id : crypto.randomUUID(),
        name: typeof call.function.name === "string" ? call.function.name : "tool",
        input: safeJsonParse(typeof call.function.arguments === "string" ? call.function.arguments : "{}") ?? {}
      });
    }
  }
  return content;
}

function openAiContentToText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((item) => {
    if (!isRecord(item)) return "";
    if (item.type === "text" && typeof item.text === "string") return item.text;
    if (typeof item.content === "string") return item.content;
    return "";
  }).filter(Boolean).join("\n\n");
}

function openAiToolToAnthropic(tool: unknown) {
  if (!isRecord(tool) || tool.type !== "function" || !isRecord(tool.function)) return null;
  const name = typeof tool.function.name === "string" ? tool.function.name : "";
  if (!name) return null;
  return {
    name,
    description: typeof tool.function.description === "string" ? tool.function.description : "",
    input_schema: isRecord(tool.function.parameters) ? tool.function.parameters : { type: "object", properties: {} }
  };
}

function anthropicToOpenAiChatCompletion(body: unknown, model: string) {
  if (!isRecord(body) || !Array.isArray(body.content)) return body;
  const toolCalls = body.content
    .filter((item): item is Record<string, unknown> => isRecord(item) && item.type === "tool_use")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
      type: "function",
      function: {
        name: typeof item.name === "string" ? item.name : "tool",
        arguments: JSON.stringify(item.input ?? {})
      }
    }));
  const text = body.content
    .filter((item): item is Record<string, unknown> => isRecord(item) && item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("");
  return {
    id: typeof body.id === "string" ? body.id : `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {})
      },
      finish_reason: anthropicStopReasonToOpenAi(body.stop_reason)
    }],
    usage: anthropicUsageToOpenAi(body.usage)
  };
}

async function proxyOpenAiChatCompletionStream(
  reply: FastifyReply,
  upstreamResponse: Response,
  input: { id: string; startedMs: number; responseHeadersJson: string; requestMessageCount: number; model: string }
) {
  reply.code(upstreamResponse.status);
  reply.header("content-type", "text/event-stream");
  reply.header("cache-control", "no-cache");
  reply.raw.writeHead(upstreamResponse.status, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache"
  });
  const accumulator = new AnthropicSseAccumulator();
  const outEvents: string[] = [];
  try {
    if (!upstreamResponse.body) throw new Error("Upstream stream is empty");
    const reader = upstreamResponse.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const text = decoder.decode(value, { stream: true });
      accumulator.push(text);
      for (const event of anthropicSseChunkToOpenAi(text, input.model)) {
        outEvents.push(event);
        reply.raw.write(`data: ${event}\n\n`);
      }
    }
    accumulator.push(decoder.decode());
    accumulator.finish();
    reply.raw.write("data: [DONE]\n\n");
    if (accumulator.assistantText) {
      storage.addMessages(input.id, [{
        role: "assistant",
        contentType: "text",
        text: accumulator.assistantText,
        ord: input.requestMessageCount
      }]);
    }
    storage.finishCapture({
      id: input.id,
      status: upstreamResponse.status,
      startedMs: input.startedMs,
      responseJson: JSON.stringify(buildStreamResponse(upstreamResponse.status, accumulator), null, 2),
      responseHeadersJson: input.responseHeadersJson,
      sseEventsJsonl: outEvents.join("\n"),
      inputTokens: accumulator.inputTokens,
      outputTokens: accumulator.outputTokens
    });
  } catch (error) {
    storage.finishCapture({
      id: input.id,
      status: upstreamResponse.status,
      startedMs: input.startedMs,
      responseJson: JSON.stringify(buildStreamResponse(upstreamResponse.status, accumulator, error), null, 2),
      responseHeadersJson: input.responseHeadersJson,
      sseEventsJsonl: outEvents.join("\n"),
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    reply.raw.end();
  }
}

function anthropicSseChunkToOpenAi(chunk: string, model: string) {
  const events: string[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trimStart();
    if (!data || data === "[DONE]") continue;
    const parsed = safeJsonParse(data);
    if (!isRecord(parsed)) continue;
    if (parsed.type === "content_block_delta" && isRecord(parsed.delta) && parsed.delta.type === "text_delta" && typeof parsed.delta.text === "string") {
      events.push(JSON.stringify(openAiStreamChunk(model, { content: parsed.delta.text })));
    }
    if (parsed.type === "message_delta") {
      events.push(JSON.stringify(openAiStreamChunk(model, {}, anthropicStopReasonToOpenAi(parsed.delta && isRecord(parsed.delta) ? parsed.delta.stop_reason : null))));
    }
  }
  return events;
}

function openAiStreamChunk(model: string, delta: Record<string, unknown>, finishReason: unknown = null) {
  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }]
  };
}

function anthropicUsageToOpenAi(usage: unknown) {
  if (!isRecord(usage)) return undefined;
  const promptTokens = numberOrDefault(usage.input_tokens, 0);
  const completionTokens = numberOrDefault(usage.output_tokens, 0);
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens
  };
}

function anthropicStopReasonToOpenAi(value: unknown) {
  if (value === "end_turn") return "stop";
  if (value === "max_tokens") return "length";
  if (value === "tool_use") return "tool_calls";
  return value ?? null;
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isAnthropicBaseUrl(baseUrl: string) {
  try {
    const url = new URL(normalizeBaseUrl(baseUrl));
    return url.hostname === "api.anthropic.com";
  } catch {
    return false;
  }
}

async function proxyStream(
  reply: FastifyReply,
  upstreamResponse: Response,
  input: { id: string; startedMs: number; responseHeadersJson: string; requestMessageCount: number }
) {
  reply.code(upstreamResponse.status);
  copyHeaders(reply, upstreamResponse.headers);
  reply.hijack();
  reply.raw.writeHead(upstreamResponse.status, headersToObject(upstreamResponse.headers));
  const accumulator = new AnthropicSseAccumulator();
  try {
    if (!upstreamResponse.body) throw new Error("Upstream stream is empty");
    const reader = upstreamResponse.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        reply.raw.write(Buffer.from(value));
        accumulator.push(decoder.decode(value, { stream: true }));
      }
    }
    accumulator.push(decoder.decode());
    accumulator.finish();
    if (accumulator.assistantText) {
      storage.addMessages(input.id, [{
        role: "assistant",
        contentType: "text",
        text: accumulator.assistantText,
        ord: input.requestMessageCount
      }]);
    }
    storage.finishCapture({
      id: input.id,
      status: upstreamResponse.status,
      startedMs: input.startedMs,
      responseJson: JSON.stringify(buildStreamResponse(upstreamResponse.status, accumulator), null, 2),
      responseHeadersJson: input.responseHeadersJson,
      sseEventsJsonl: accumulator.events.join("\n"),
      inputTokens: accumulator.inputTokens,
      outputTokens: accumulator.outputTokens
    });
  } catch (error) {
    storage.finishCapture({
      id: input.id,
      status: upstreamResponse.status,
      startedMs: input.startedMs,
      responseJson: JSON.stringify(buildStreamResponse(upstreamResponse.status, accumulator, error), null, 2),
      responseHeadersJson: input.responseHeadersJson,
      sseEventsJsonl: accumulator.events.join("\n"),
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    reply.raw.end();
  }
}

function buildStreamResponse(status: number, accumulator: AnthropicSseAccumulator, error?: unknown) {
  return {
    stream: true,
    status,
    assistantText: accumulator.assistantText,
    inputTokens: accumulator.inputTokens,
    outputTokens: accumulator.outputTokens,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    events: accumulator.events.map((item) => safeJsonParse(item))
  };
}

function copyHeaders(reply: { header: (name: string, value: string) => unknown }, headers: Headers) {
  headers.forEach((value, key) => {
    if (["content-encoding", "transfer-encoding", "connection"].includes(key.toLowerCase())) return;
    reply.header(key, value);
  });
}

function headersToObject(headers: Headers) {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bodyToText(body: unknown) {
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  if (body === undefined || body === null) return "";
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

function detectAgent(headers: Record<string, string | string[] | undefined>, bodyText: string) {
  const text = `${JSON.stringify(redactHeaders(headers))}\n${bodyText}`.toLowerCase();
  if (text.includes("claude code") || text.includes("claude-code") || text.includes("cc_version=")) return "Claude Code";
  if (text.includes("opencode") || text.includes("openclaw")) return "OpenClaw";
  if (text.includes("hermes")) return "Hermes";
  if (text.includes("codex cli") || text.includes("codex-cli")) return "CodeX CLI";
  if (text.includes("openai codex") || text.includes("codex")) return "OpenAI CodeX";
  return null;
}
