import Database from "better-sqlite3";
import { chmodSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { CaptureSummary, ProviderConfig } from "./types.js";

const appDir = join(homedir(), ".agent-charles");
const dbPath = join(appDir, "agent-charles.db");
type DbCaptureSummary = Omit<CaptureSummary, "stream"> & { stream: 0 | 1 };

export class Storage {
  private db: Database.Database;

  constructor() {
    mkdirSync(appDir, { recursive: true, mode: 0o700 });
    this.db = new Database(dbPath);
    chmodSync(appDir, 0o700);
    try {
      chmodSync(dbPath, 0o600);
    } catch {
      // The file is created lazily by sqlite on first open.
    }
    this.migrate();
  }

  get path() {
    return dbPath;
  }

  getProviderConfig(): ProviderConfig {
    const defaults: ProviderConfig = {
      baseUrl: "https://api.anthropic.com",
      apiKey: "",
      apiVersion: "2023-06-01",
      authHeader: "x-api-key",
      defaultModel: "",
      extraHeaders: {}
    };
    const raw = this.getSetting("provider");
    if (!raw) {
      return defaults;
    }
    return { ...defaults, ...JSON.parse(raw) };
  }

  saveProviderConfig(config: ProviderConfig) {
    this.setSetting("provider", JSON.stringify(config));
  }

  getClaudeSettingsPath() {
    return this.getSetting("claudeSettingsPath");
  }

  saveClaudeSettingsPath(settingsPath: string) {
    this.setSetting("claudeSettingsPath", settingsPath);
  }

  getAgentSettingsPath(agentId: string) {
    return this.getSetting(`agentSettingsPath:${agentId}`);
  }

  saveAgentSettingsPath(agentId: string, settingsPath: string) {
    this.setSetting(`agentSettingsPath:${agentId}`, settingsPath);
  }

  createCapture(input: {
    id: string;
    method: string;
    path: string;
    model: string | null;
    agent: string | null;
    stream: boolean;
    requestJson: string;
    requestHeadersJson: string;
    summary: string | null;
  }) {
    const now = new Date().toISOString();
    const insertCapture = this.db.prepare(`
      insert into captures (
        id, started_at, method, path, model, agent, stream, summary
      ) values (
        @id, @startedAt, @method, @path, @model, @agent, @stream, @summary
      )
    `);
    const insertPayload = this.db.prepare(`
      insert into capture_payloads (
        capture_id, request_json, request_headers_json, response_json,
        response_headers_json, sse_events_jsonl
      ) values (
        @id, @requestJson, @requestHeadersJson, '', '', ''
      )
    `);
    const tx = this.db.transaction(() => {
      insertCapture.run({
        id: input.id,
        startedAt: now,
        method: input.method,
        path: input.path,
        model: input.model,
        agent: input.agent,
        stream: input.stream ? 1 : 0,
        summary: input.summary
      });
      insertPayload.run({
        id: input.id,
        requestJson: input.requestJson,
        requestHeadersJson: input.requestHeadersJson
      });
    });
    tx();
  }

  finishCapture(input: {
    id: string;
    status: number | null;
    startedMs: number;
    responseJson?: string;
    responseHeadersJson?: string;
    sseEventsJsonl?: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    error?: string | null;
  }) {
    const endedAt = new Date().toISOString();
    const durationMs = Date.now() - input.startedMs;
    const updateCapture = this.db.prepare(`
      update captures set
        ended_at = @endedAt,
        status = @status,
        duration_ms = @durationMs,
        input_tokens = @inputTokens,
        output_tokens = @outputTokens,
        error = @error
      where id = @id
    `);
    const updatePayload = this.db.prepare(`
      update capture_payloads set
        response_json = coalesce(@responseJson, response_json),
        response_headers_json = coalesce(@responseHeadersJson, response_headers_json),
        sse_events_jsonl = coalesce(@sseEventsJsonl, sse_events_jsonl)
      where capture_id = @id
    `);
    const tx = this.db.transaction(() => {
      updateCapture.run({
        id: input.id,
        endedAt,
        status: input.status,
        durationMs,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        error: input.error ?? null
      });
      updatePayload.run({
        id: input.id,
        responseJson: input.responseJson ?? null,
        responseHeadersJson: input.responseHeadersJson ?? null,
        sseEventsJsonl: input.sseEventsJsonl ?? null
      });
    });
    tx();
  }

  addMessages(captureId: string, messages: Array<{ role: string; contentType: string; text: string; ord: number }>) {
    const stmt = this.db.prepare(`
      insert into capture_messages (capture_id, role, content_type, text, ord)
      values (@captureId, @role, @contentType, @text, @ord)
    `);
    const tx = this.db.transaction(() => {
      for (const message of messages) {
        stmt.run({ captureId, ...message });
      }
    });
    tx();
  }

  listCaptures(): CaptureSummary[] {
    const rows = this.db.prepare(`
      select
        id,
        started_at as startedAt,
        ended_at as endedAt,
        method,
        path,
        status,
        model,
        agent,
        stream,
        duration_ms as durationMs,
        input_tokens as inputTokens,
        output_tokens as outputTokens,
        error,
        summary,
        (
          select text from capture_messages
          where capture_id = captures.id and role = 'assistant'
          order by ord desc
          limit 1
        ) as assistantText,
        (
          select text from capture_messages
          where capture_id = captures.id and role = 'user'
          order by ord desc
          limit 1
        ) as lastUserText,
        (
          select text from capture_messages
          where capture_id = captures.id and role = 'system'
          order by ord asc
          limit 1
        ) as systemText,
        (
          select request_json from capture_payloads
          where capture_id = captures.id
          limit 1
        ) as requestJson
      from captures
      order by started_at asc
      limit 300
    `).all() as DbCaptureSummary[];
    return rows.map((row) => ({ ...row, stream: Boolean(row.stream) }));
  }

  getCapture(id: string) {
    const capture = this.db.prepare(`
      select
        id,
        started_at as startedAt,
        ended_at as endedAt,
        method,
        path,
        status,
        model,
        agent,
        stream,
        duration_ms as durationMs,
        input_tokens as inputTokens,
        output_tokens as outputTokens,
        error,
        summary
      from captures
      where id = ?
    `).get(id) as DbCaptureSummary | undefined;
    if (!capture) return null;
    const payload = this.db.prepare(`
      select
        request_json as requestJson,
        request_headers_json as requestHeadersJson,
        response_json as responseJson,
        response_headers_json as responseHeadersJson,
        sse_events_jsonl as sseEventsJsonl
      from capture_payloads
      where capture_id = ?
    `).get(id) as {
      requestJson: string;
      requestHeadersJson: string;
      responseJson: string;
      responseHeadersJson: string;
      sseEventsJsonl: string;
    } | undefined;
    const messages = this.db.prepare(`
      select role, content_type as contentType, text, ord
      from capture_messages
      where capture_id = ?
      order by ord asc
    `).all(id) as Array<{ role: string; contentType: string; text: string; ord: number }>;
    return {
      ...capture,
      stream: Boolean(capture.stream),
      payload,
      messages
    };
  }

  clearCaptures() {
    this.db.exec("delete from capture_messages; delete from capture_payloads; delete from captures;");
  }

  private getSetting(key: string): string | null {
    const row = this.db.prepare("select value from settings where key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private setSetting(key: string, value: string) {
    this.db.prepare(`
      insert into settings (key, value)
      values (?, ?)
      on conflict(key) do update set value = excluded.value
    `).run(key, value);
  }

  private migrate() {
    this.db.exec(`
      create table if not exists settings (
        key text primary key,
        value text not null
      );

      create table if not exists captures (
        id text primary key,
        started_at text not null,
        ended_at text,
        method text not null,
        path text not null,
        status integer,
        model text,
        agent text,
        stream integer not null default 0,
        duration_ms integer,
        input_tokens integer,
        output_tokens integer,
        error text,
        summary text
      );

      create table if not exists capture_payloads (
        capture_id text primary key references captures(id) on delete cascade,
        request_json text not null,
        request_headers_json text not null,
        response_json text not null default '',
        response_headers_json text not null default '',
        sse_events_jsonl text not null default ''
      );

      create table if not exists capture_messages (
        id integer primary key autoincrement,
        capture_id text not null references captures(id) on delete cascade,
        role text not null,
        content_type text not null,
        text text not null,
        ord integer not null
      );

      create index if not exists idx_captures_started_at on captures(started_at desc);
      create index if not exists idx_capture_messages_capture_id on capture_messages(capture_id, ord);
    `);
    this.addColumnIfMissing("captures", "agent", "text");
    mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  }

  private addColumnIfMissing(table: string, column: string, type: string) {
    const columns = this.db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((item) => item.name === column)) {
      this.db.exec(`alter table ${table} add column ${column} ${type}`);
    }
  }
}
