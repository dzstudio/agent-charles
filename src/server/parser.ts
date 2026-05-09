type AnthropicContent = string | Array<{
  type?: string;
  text?: string;
  content?: unknown;
  name?: string;
  id?: string;
  input?: unknown;
}>;

export function redactHeaders(headers: Record<string, string | string[] | undefined>) {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (["x-api-key", "api-key", "authorization", "proxy-authorization", "cookie"].includes(lower)) {
      result[key] = "[redacted]";
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function extractRequestMessages(body: unknown) {
  const out: Array<{ role: string; contentType: string; text: string; ord: number }> = [];
  let ord = 0;
  if (!isRecord(body)) return out;

  const system = body.system;
  if (typeof system === "string" && system.trim()) {
    out.push({ role: "system", contentType: "text", text: system, ord: ord++ });
  } else if (Array.isArray(system)) {
    const text = contentToText(system as AnthropicContent);
    if (text) out.push({ role: "system", contentType: "text", text, ord: ord++ });
  }

  if (Array.isArray(body.messages)) {
    for (const message of body.messages) {
      if (!isRecord(message)) continue;
      const role = typeof message.role === "string" ? message.role : "unknown";
      const text = contentToText(message.content as AnthropicContent);
      if (text) out.push({ role, contentType: "text", text, ord: ord++ });
    }
  }
  return out;
}

export function extractResponseMessages(body: unknown, startOrd: number) {
  if (!isRecord(body)) return [];
  if (Array.isArray(body.choices)) {
    const first = body.choices.find(isRecord);
    if (first && isRecord(first.message)) {
      const text = contentToText(first.message.content as AnthropicContent);
      if (text) return [{ role: "assistant", contentType: "text", text, ord: startOrd }];
    }
  }
  const text = contentToText(body.content as AnthropicContent);
  if (!text) return [];
  return [{ role: "assistant", contentType: "text", text, ord: startOrd }];
}

export function requestSummary(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.messages)) return null;
  for (let i = body.messages.length - 1; i >= 0; i--) {
    const message = body.messages[i];
    if (!isRecord(message)) continue;
    const role = typeof message.role === "string" ? message.role : "unknown";
    const text = contentToText(message.content as AnthropicContent).replace(/\s+/g, " ").trim();
    if (text) return `${role}: ${text.slice(0, 120)}`;
  }
  return null;
}

export function usageFromResponse(body: unknown) {
  if (!isRecord(body) || !isRecord(body.usage)) return {};
  if ("prompt_tokens" in body.usage || "completion_tokens" in body.usage) {
    return {
      inputTokens: numberOrNull(body.usage.prompt_tokens),
      outputTokens: numberOrNull(body.usage.completion_tokens)
    };
  }
  return {
    inputTokens: numberOrNull(body.usage.input_tokens),
    outputTokens: numberOrNull(body.usage.output_tokens)
  };
}

export class AnthropicSseAccumulator {
  private buffer = "";
  private currentEvent = "";
  private currentData: string[] = [];
  readonly events: string[] = [];
  assistantText = "";
  inputTokens: number | null = null;
  outputTokens: number | null = null;

  push(chunk: string) {
    this.buffer += chunk;
    let idx = this.buffer.indexOf("\n");
    while (idx >= 0) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, "");
      this.buffer = this.buffer.slice(idx + 1);
      this.readLine(line);
      idx = this.buffer.indexOf("\n");
    }
  }

  finish() {
    if (this.buffer) {
      this.readLine(this.buffer.replace(/\r$/, ""));
      this.buffer = "";
    }
    if (this.currentEvent || this.currentData.length) {
      this.commitEvent();
    }
  }

  private readLine(line: string) {
    if (line === "") {
      this.commitEvent();
      return;
    }
    if (line.startsWith("event:")) {
      this.currentEvent = line.slice(6).trim();
      return;
    }
    if (line.startsWith("data:")) {
      this.currentData.push(line.slice(5).trimStart());
    }
  }

  private commitEvent() {
    const data = this.currentData.join("\n");
    if (this.currentEvent || data) {
      const item = { event: this.currentEvent, data };
      this.events.push(JSON.stringify(item));
      this.consume(item.event, data);
    }
    this.currentEvent = "";
    this.currentData = [];
  }

  private consume(event: string, data: string) {
    if (!data || data === "[DONE]") return;
    const parsed = safeJsonParse(data);
    if (!isRecord(parsed)) return;
    if (event === "content_block_delta" && isRecord(parsed.delta) && parsed.delta.type === "text_delta") {
      if (typeof parsed.delta.text === "string") this.assistantText += parsed.delta.text;
    }
    if (event === "message_start" && isRecord(parsed.message) && isRecord(parsed.message.usage)) {
      this.inputTokens = numberOrNull(parsed.message.usage.input_tokens);
      this.outputTokens = numberOrNull(parsed.message.usage.output_tokens);
    }
    if (event === "message_delta" && isRecord(parsed.usage)) {
      const output = numberOrNull(parsed.usage.output_tokens);
      if (output !== null) this.outputTokens = output;
    }
  }
}

function contentToText(content: AnthropicContent): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const pieces: string[] = [];
  for (const item of content) {
    if (!isRecord(item)) continue;
    if (item.type === "text" && typeof item.text === "string") {
      pieces.push(item.text);
    } else if (item.type === "tool_use") {
      const name = typeof item.name === "string" ? item.name : "tool";
      pieces.push(`[tool_use:${name}] ${JSON.stringify(item.input ?? {})}`);
    } else if (item.type === "tool_result") {
      pieces.push(`[tool_result] ${contentToText(item.content as AnthropicContent)}`);
    } else if (typeof item.text === "string") {
      pieces.push(item.text);
    }
  }
  return pieces.join("\n\n").trim();
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
