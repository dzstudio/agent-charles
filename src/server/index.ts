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
  const targetUrl = upstreamUrl(provider.baseUrl, path);
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
      headers: buildUpstreamHeaders(request.headers, provider, bodyBuffer.length),
      body: method === "GET" || method === "HEAD" ? undefined : bodyBuffer as unknown as BodyInit
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

  if (stream || contentType.includes("text/event-stream")) {
    await proxyStream(reply, upstreamResponse, {
      id,
      startedMs,
      responseHeadersJson,
      requestMessageCount: requestMessages.length
    });
    return;
  }

  const responseText = await upstreamResponse.text();
  const responseJson = safeJsonParse(responseText);
  storage.addMessages(id, extractResponseMessages(responseJson, requestMessages.length));
  const usage = usageFromResponse(responseJson);
  storage.finishCapture({
    id,
    status: upstreamResponse.status,
    startedMs,
    responseJson: responseText,
    responseHeadersJson,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens
  });

  reply.code(upstreamResponse.status);
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
    if (["host", "content-length", "x-api-key", "authorization", "connection", "accept-encoding"].includes(lower)) continue;
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== undefined) headers.set(key, value);
  }
  headers.set("content-length", String(bodyLength));
  headers.set("anthropic-version", provider.apiVersion || headers.get("anthropic-version") || "2023-06-01");
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
