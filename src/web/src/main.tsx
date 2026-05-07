import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { copy, languageOptions, setCopyLanguage, storedLanguage, type LanguageCode } from "./copy";
import "./styles.css";

type CaptureSummary = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  method: string;
  path: string;
  status: number | null;
  model: string | null;
  agent: string | null;
  stream: boolean;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  error: string | null;
  summary: string | null;
  assistantText?: string | null;
  lastUserText?: string | null;
  systemText?: string | null;
  requestJson?: string | null;
};

type CaptureDetail = CaptureSummary & {
  payload: {
    requestJson: string;
    requestHeadersJson: string;
    responseJson: string;
    responseHeadersJson: string;
    sseEventsJsonl: string;
  };
  messages: Array<{ role: string; contentType: string; text: string; ord: number }>;
};

type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  authHeader: "x-api-key" | "authorization";
  defaultModel: string;
  extraHeaders: Record<string, string>;
};

type IntegrationStatus = {
  settingsPath: string;
  backupPath: string;
  enabled: boolean;
  currentBaseUrl: string;
  hasBackup: boolean;
};

type ThemeMode = "light" | "dark";

type AgentIntegration = {
  id: string;
  name: string;
  supported: boolean;
  settingsPath: string;
  backupPath: string;
  enabled: boolean;
  currentBaseUrl: string;
  hasBackup: boolean;
  notes?: string;
};

function App() {
  const [captures, setCaptures] = useState<CaptureSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<CaptureDetail | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(() => storedTab());
  const [provider, setProvider] = useState<ProviderConfig | null>(null);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [agents, setAgents] = useState<AgentIntegration[]>([]);
  const [notice, setNotice] = useState("");
  const [listMode, setListMode] = useState<"conversations" | "api">("conversations");
  const [sidebarWidth, setSidebarWidth] = useState(() => storedNumber("agent-charles-sidebar-width", 380));
  const [settingsWidth, setSettingsWidth] = useState(() => storedNumber("agent-charles-settings-width", 340, 280, 620));
  const [settingsCollapsed, setSettingsCollapsed] = useState(() => storedBoolean("agent-charles-settings-collapsed", true));
  const [theme, setTheme] = useState<ThemeMode>(() => storedTheme());
  const [language, setLanguage] = useState<LanguageCode>(() => storedLanguage());

  setCopyLanguage(language);

  async function refreshCaptures() {
    const rows = await api<CaptureSummary[]>("/api/captures");
    setCaptures(rows);
  }

  async function refreshSettings() {
    const [providerRes, statusRes] = await Promise.all([
      api<ProviderConfig>("/api/provider"),
      api<IntegrationStatus>("/api/claude-code/status")
    ]);
    const agentRes = await api<AgentIntegration[]>("/api/agents");
    setProvider(providerRes);
    setStatus(statusRes);
    setAgents(agentRes);
  }

  useEffect(() => {
    refreshCaptures();
    refreshSettings();
    const timer = window.setInterval(refreshCaptures, 1500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("agent-charles-theme", theme);
  }, [theme]);

  useEffect(() => {
    setCopyLanguage(language);
    window.localStorage.setItem("agent-charles-language", language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("agent-charles-settings-collapsed", String(settingsCollapsed));
  }, [settingsCollapsed]);

  useEffect(() => {
    window.localStorage.setItem("agent-charles-detail-tab", tab);
  }, [tab]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api<CaptureDetail>(`/api/captures/${selectedId}`).then(setDetail).catch(() => setDetail(null));
  }, [selectedId, captures]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = listMode === "conversations" ? conversationRows(captures) : captures;
    if (!q) return rows;
    return rows.filter((item) =>
      [item.model, item.status, item.summary, item.path, item.error]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [captures, listMode, query]);

  async function saveProvider(next: ProviderConfig) {
    const saved = await api<ProviderConfig>("/api/provider", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next)
    });
    setProvider(saved);
    flash(copy.notices.providerSaved);
  }

  async function enableIntegration() {
    if (!window.confirm(copy.confirms.startClaude)) {
      return;
    }
    const nextStatus = await api<IntegrationStatus>("/api/claude-code/enable", { method: "POST" });
    setStatus(nextStatus);
    const message = copy.notices.claudeStarted;
    flash(message);
    window.alert(message);
  }

  async function disableIntegration() {
    if (!window.confirm(copy.confirms.stopClaude)) {
      return;
    }
    const nextStatus = await api<IntegrationStatus>("/api/claude-code/disable", { method: "POST" });
    setStatus(nextStatus);
    const message = nextStatus.hasBackup
      ? copy.notices.claudeStoppedRestored
      : copy.notices.claudeStoppedNoBackup;
    flash(message);
    window.alert(message);
  }

  async function clearCaptures() {
    if (!window.confirm(copy.confirms.clearCaptures)) {
      return;
    }
    await api("/api/captures", { method: "DELETE" });
    setSelectedId("");
    setDetail(null);
    await refreshCaptures();
  }

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2800);
  }

  function toggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  function startSidebarResize(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(620, Math.max(280, startWidth + moveEvent.clientX - startX));
      setSidebarWidth(nextWidth);
      window.localStorage.setItem("agent-charles-sidebar-width", String(nextWidth));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startSettingsResize(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = settingsWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(620, Math.max(280, startWidth + startX - moveEvent.clientX));
      setSettingsWidth(nextWidth);
      window.localStorage.setItem("agent-charles-settings-width", String(nextWidth));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <main className="app-shell" style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}>
      <aside className="sidebar">
        <div className="brand">
          <div>
            <h1>{copy.app.title}</h1>
            <p>{copy.app.subtitle}</p>
          </div>
          <button title={copy.tooltips.clearCaptures} onClick={clearCaptures}>{copy.actions.clear}</button>
        </div>
        <div className="capture-toolbar">
          <input
            className="search"
            placeholder={copy.labels.searchCaptures}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="list-mode">
            <button className={listMode === "conversations" ? "active" : ""} onClick={() => setListMode("conversations")}>{copy.labels.conversations}</button>
            <button className={listMode === "api" ? "active" : ""} onClick={() => setListMode("api")}>{copy.labels.apiCalls}</button>
          </div>
        </div>
        <div className="capture-list">
          {filtered.map((item) => (
            <button
              className={`capture-row ${item.id === selectedId ? "active" : ""}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="row-time">{formatTime(item.startedAt)}</span>
              <span className={`status s${item.status ?? "pending"}`}>{item.status ?? "..."}</span>
              <span className="row-model">{item.model ?? copy.labels.unknownModel} {item.agent && <span className="agent-tag">{item.agent}</span>}</span>
              <span className="row-summary">{item.summary ?? item.path}</span>
              <span className="row-meta">{item.durationMs ?? 0}ms {item.stream ? copy.labels.streamType : copy.labels.jsonType}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="empty">{copy.labels.noCaptures}</div>}
        </div>
      </aside>
      <div
        className="sidebar-resizer"
        onMouseDown={startSidebarResize}
        style={{ left: sidebarWidth - 4 }}
        title={copy.tooltips.resizeCaptures}
      />

      <section className="content">
        <header className="topbar">
          <div>
            <strong>{detail?.model ?? copy.labels.waitingForTraffic}</strong>
            <span>{detail ? `${detail.method} ${detail.path}` : copy.labels.configureAndStart}</span>
          </div>
          <div className="topbar-actions">
            {notice && <output>{notice}</output>}
            <select
              className="language-select"
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageCode)}
              title={copy.tooltips.language}
              aria-label={copy.tooltips.language}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
            <button
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              title={theme === "dark" ? copy.tooltips.switchToLight : copy.tooltips.switchToDark}
              aria-label={theme === "dark" ? copy.tooltips.switchToLight : copy.tooltips.switchToDark}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              className={`icon-button settings-toggle ${settingsCollapsed ? "" : "active"}`}
              onClick={() => setSettingsCollapsed(!settingsCollapsed)}
              title={settingsCollapsed ? copy.tooltips.expandSettings : copy.tooltips.collapseSettings}
              aria-label={settingsCollapsed ? copy.tooltips.expandSettings : copy.tooltips.collapseSettings}
            >
              <SettingsIcon />
            </button>
          </div>
        </header>

        <section className="workspace" style={{ gridTemplateColumns: `1fr ${settingsCollapsed ? 48 : settingsWidth}px` }}>
          <section className="detail">
            <nav className="tabs">
              {["messages", "content", "stream", "headers"].map((name) => (
                <button className={tab === name ? "active" : ""} key={name} onClick={() => setTab(name)}>
                  {copy.tabs[name as keyof typeof copy.tabs]}
                </button>
              ))}
            </nav>
            <DetailPanel detail={detail} tab={tab} />
          </section>

          <aside className={`settings ${settingsCollapsed ? "collapsed" : ""}`}>
            {!settingsCollapsed && <div className="settings-resizer" onMouseDown={startSettingsResize} title={copy.tooltips.resizeSettings} />}
            {!settingsCollapsed && (
              <>
                <ProviderPanel provider={provider} onSave={saveProvider} />
                <IntegrationPanel
                  status={status}
                  onEnable={enableIntegration}
                  onDisable={disableIntegration}
                  onStatusChange={setStatus}
                  onNotice={flash}
                />
                {agents.filter((agent) => agent.id !== "claude-code").map((agent) => (
                  <AgentIntegrationPanel
                    key={agent.id}
                    agent={agent}
                    onAgentsChange={setAgents}
                    onNotice={flash}
                  />
                ))}
              </>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}

function DetailPanel({ detail, tab }: { detail: CaptureDetail | null; tab: string }) {
  if (!detail) return <div className="empty large">{copy.labels.noCaptureSelected}</div>;
  if (tab === "content") return <ContentPanel detail={detail} />;
  if (tab === "messages") {
    return (
      <div className="messages">
        {detail.messages.map((message) => (
          <article className="message" key={`${message.ord}-${message.role}`}>
            <header>{message.role}</header>
            <pre>{message.text}</pre>
          </article>
        ))}
        {detail.messages.length === 0 && <div className="empty">{copy.labels.noMessages}</div>}
      </div>
    );
  }
  if (tab === "stream") return <CodeBlock value={detail.payload.sseEventsJsonl || copy.labels.noStreamEvents} />;
  return (
    <div className="split-code">
      <CodeBlock title={copy.labels.requestHeaders} value={pretty(detail.payload.requestHeadersJson)} />
      <CodeBlock title={copy.labels.responseHeaders} value={pretty(detail.payload.responseHeadersJson)} />
    </div>
  );
}

function ContentPanel({ detail }: { detail: CaptureDetail }) {
  const request = pretty(detail.payload.requestJson);
  const response = responseText(detail);
  return (
    <div className="content-panel">
      <ContentBlock
        title={copy.labels.request}
        value={request}
        metric={metricText(detail.inputTokens, request)}
        meta={<RequestMeta detail={detail} />}
      />
      <ContentBlock title={copy.labels.response} value={response.value} metric={metricText(detail.outputTokens, response.value)} tone={response.tone} />
    </div>
  );
}

function ContentBlock({
  title,
  value,
  metric,
  meta,
  tone
}: {
  title: string;
  value: string;
  metric: string;
  meta?: React.ReactNode;
  tone?: "error";
}) {
  return (
    <section className="content-block">
      <header>
        <h2>{title}</h2>
        <span>{metric}</span>
      </header>
      {meta}
      <CodeBlock value={value} tone={tone} compact />
    </section>
  );
}

function RequestMeta({ detail }: { detail: CaptureDetail }) {
  const requestBody = detail.payload.requestJson || "";
  const bodyBytes = new TextEncoder().encode(requestBody).length;
  return (
    <dl className="request-meta">
      <div>
        <dt>{copy.labels.url}</dt>
        <dd>{detail.method} {detail.path}</dd>
      </div>
      <div>
        <dt>{copy.labels.requested}</dt>
        <dd>{new Date(detail.startedAt).toLocaleString()}</dd>
      </div>
      <div>
        <dt>{copy.labels.duration}</dt>
        <dd>{detail.durationMs ?? 0}ms</dd>
      </div>
      <div>
        <dt>{copy.labels.body}</dt>
        <dd>{bodyBytes.toLocaleString()} {copy.units.bytes}</dd>
      </div>
    </dl>
  );
}

function ProviderPanel({ provider, onSave }: { provider: ProviderConfig | null; onSave: (next: ProviderConfig) => void }) {
  const [draft, setDraft] = useState<ProviderConfig | null>(provider);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  useEffect(() => setDraft(provider), [provider]);
  if (!draft) return null;
  return (
    <section className="panel">
      <h2>{copy.labels.llmProvider}</h2>
      <label>{copy.labels.baseUrl}<input value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} /></label>
      <label>{copy.labels.apiKey}<input type="password" placeholder={provider?.apiKey ? copy.labels.saved : copy.labels.required} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} /></label>
      <label>{copy.labels.defaultModel}<input value={draft.defaultModel} onChange={(e) => setDraft({ ...draft, defaultModel: e.target.value })} /></label>
      <div className="provider-actions">
        <button className="link-button" onClick={() => setAdvancedOpen(!advancedOpen)}>
          {advancedOpen ? copy.actions.hideAdvanced : copy.actions.showAdvanced}
        </button>
        <button className="primary" onClick={() => onSave({ ...draft, apiKey: draft.apiKey === "********" ? "" : draft.apiKey })}>{copy.actions.saveProvider}</button>
      </div>
      {advancedOpen && (
        <div className="advanced">
          <label>{copy.labels.apiVersion}<input value={draft.apiVersion} onChange={(e) => setDraft({ ...draft, apiVersion: e.target.value })} /></label>
          <label>{copy.labels.authHeader}
            <select value={draft.authHeader} onChange={(e) => setDraft({ ...draft, authHeader: e.target.value as ProviderConfig["authHeader"] })}>
              <option value="x-api-key">x-api-key</option>
              <option value="authorization">authorization bearer</option>
            </select>
          </label>
        </div>
      )}
    </section>
  );
}

function AgentIntegrationPanel({
  agent,
  onAgentsChange,
  onNotice
}: {
  agent: AgentIntegration;
  onAgentsChange: (agents: AgentIntegration[]) => void;
  onNotice: (message: string) => void;
}) {
  const [settingsPath, setSettingsPath] = useState(agent.settingsPath);
  useEffect(() => setSettingsPath(agent.settingsPath), [agent.settingsPath]);

  async function refresh() {
    onAgentsChange(await api<AgentIntegration[]>("/api/agents"));
  }

  async function savePath() {
    await api<AgentIntegration>(`/api/agents/${agent.id}/settings-path`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settingsPath })
    });
    await refresh();
    onNotice(copy.notices.agentPathSaved(agent.name));
  }

  async function start() {
    if (agent.supported && !settingsPath.trim()) {
      window.alert(copy.errors.settingsPathRequired(agent.name));
      return;
    }
    try {
      await api<AgentIntegration>(`/api/agents/${agent.id}/start`, { method: "POST" });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
      return;
    }
    await refresh();
    onNotice(copy.notices.agentStarted(agent.name));
  }

  async function stop() {
    try {
      await api<AgentIntegration>(`/api/agents/${agent.id}/stop`, { method: "POST" });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
      return;
    }
    await refresh();
    onNotice(copy.notices.agentStopped(agent.name));
  }

  return (
    <section className="panel">
      <h2>{agent.name}</h2>
      {agent.supported ? (
        <>
          <div className="recording-row">
            <div className={`pill ${agent.enabled ? "recording" : ""}`}>
              {agent.enabled && <span className="recording-dot" />}
              {agent.enabled ? copy.labels.recording : copy.labels.stopped}
            </div>
            {agent.enabled ? <button onClick={stop}>{copy.actions.stop}</button> : <button className="primary" onClick={start}>{copy.actions.start}</button>}
          </div>
          <label>{copy.labels.settingsPath}
            <span className="path-input-row">
              <input
                value={settingsPath}
                placeholder={copy.placeholders.agentSettingsPath[agent.id] ?? copy.placeholders.fallbackSettingsPath}
                onChange={(event) => setSettingsPath(event.target.value)}
              />
              <button className="icon-button save-path-button" onClick={savePath} title={copy.tooltips.saveSettingsPath} aria-label={copy.tooltips.saveSettingsPath}>
                <CheckIcon />
              </button>
            </span>
          </label>
          <p className="hint">{copy.labels.backup}: {agent.backupPath || copy.labels.setPathFirst} ({agent.hasBackup ? copy.labels.available : copy.labels.notFound})</p>
          {agent.notes && <p className="hint">{agent.notes}</p>}
        </>
      ) : (
        <>
        <div className="recording-row">
          <div className="pill">{copy.labels.manual}</div>
        </div>
        <p className="hint">{agent.notes}</p>
        </>
      )}
    </section>
  );
}

function IntegrationPanel({
  status,
  onEnable,
  onDisable,
  onStatusChange,
  onNotice
}: {
  status: IntegrationStatus | null;
  onEnable: () => void;
  onDisable: () => void;
  onStatusChange: (status: IntegrationStatus) => void;
  onNotice: (message: string) => void;
}) {
  const [settingsPath, setSettingsPath] = useState("");
  useEffect(() => {
    setSettingsPath(status?.settingsPath ?? "");
  }, [status?.settingsPath]);
  if (!status) return null;
  async function saveSettingsPath() {
    const nextStatus = await api<IntegrationStatus>("/api/claude-code/settings-path", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settingsPath })
    });
    onStatusChange(nextStatus);
    onNotice(copy.notices.claudePathSaved);
  }
  return (
    <section className="panel">
      <h2>Claude Code</h2>
      <div className="recording-row">
        <div className={`pill ${status.enabled ? "recording" : ""}`}>
          {status.enabled && <span className="recording-dot" />}
          {status.enabled ? copy.labels.recording : copy.labels.stopped}
        </div>
        {status.enabled
          ? <button onClick={onDisable}>{copy.actions.stop}</button>
          : <button className="primary" onClick={onEnable}>{copy.actions.start}</button>}
      </div>
      <label>{copy.labels.settingsPath}
        <span className="path-input-row">
          <input
            value={settingsPath}
            placeholder={copy.placeholders.agentSettingsPath["claude-code"]}
            onChange={(event) => setSettingsPath(event.target.value)}
          />
          <button className="icon-button save-path-button" onClick={saveSettingsPath} title={copy.tooltips.saveSettingsPath} aria-label={copy.tooltips.saveSettingsPath}>
            <CheckIcon />
          </button>
        </span>
      </label>
      <p className="hint">{copy.labels.backup}: {status.backupPath} ({status.hasBackup ? copy.labels.available : copy.labels.notFound})</p>
      <p className="hint">{copy.labels.currentBaseUrl}: {status.currentBaseUrl || copy.labels.notSet}</p>
    </section>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 15.5A8.7 8.7 0 0 1 8.5 3.8 8.8 8.8 0 1 0 20.2 15.5Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1a2.1 2.1 0 0 1-3 3l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7v.2a2.1 2.1 0 0 1-4.2 0v-.2a1.8 1.8 0 0 0-1.2-1.7 1.8 1.8 0 0 0-2 .4l-.1.1a2.1 2.1 0 0 1-3-3l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1.1h-.2a2.1 2.1 0 0 1 0-4.2H2a1.8 1.8 0 0 0 1.7-1.2 1.8 1.8 0 0 0-.4-2l-.1-.1a2.1 2.1 0 0 1 3-3l.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.2-1.7V2a2.1 2.1 0 0 1 4.2 0v.2a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.4l.1-.1a2.1 2.1 0 0 1 3 3l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.2h.2a2.1 2.1 0 0 1 0 4.2h-.2a1.8 1.8 0 0 0-1.7 1.1Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.3 4.3L19.5 6.6" />
    </svg>
  );
}

function CodeBlock({ value, title, tone, compact }: { value: string; title?: string; tone?: "error"; compact?: boolean }) {
  return (
    <div className={`code-wrap ${compact ? "compact" : ""}`}>
      {title && <h3>{title}</h3>}
      <pre className={`code ${tone === "error" ? "error-code" : ""}`}>{value}</pre>
    </div>
  );
}

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

function metricText(tokens: number | null, value: string) {
  const chars = [...value].length.toLocaleString();
  if (typeof tokens === "number" && Number.isFinite(tokens)) return `${tokens.toLocaleString()} ${copy.units.tokens} · ${chars} ${copy.units.chars}`;
  return `${chars} ${copy.units.chars}`;
}

function pretty(value: string) {
  if (!value) return "";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function responseText(detail: CaptureDetail) {
  if (detail.payload.responseJson) {
    return {
      value: pretty(detail.payload.responseJson),
      tone: detail.error ? "error" as const : undefined
    };
  }
  if (!detail.stream) {
    return {
      value: JSON.stringify({
        error: detail.error || copy.errors.emptyResponseBody,
        status: detail.status,
        message: copy.errors.noResponseBody
      }, null, 2),
      tone: "error" as const
    };
  }
  const assistant = detail.messages.find((message) => message.role === "assistant")?.text ?? "";
  const events = detail.payload.sseEventsJsonl
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return line;
      }
    });
  if (!assistant && events.length === 0) {
    return {
      value: JSON.stringify({
        error: detail.error || copy.errors.emptyStreamResponse,
        status: detail.status,
        message: copy.errors.noStreamEvents
      }, null, 2),
      tone: "error" as const
    };
  }
  return {
    value: JSON.stringify({
    stream: true,
    status: detail.status,
    assistantText: assistant,
    error: detail.error,
    events
  }, null, 2),
    tone: detail.error ? "error" as const : undefined
  };
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour12: false });
}

function conversationRows(rows: CaptureSummary[]) {
  const useful = rows.filter((row) => {
    if ((row.status ?? 0) >= 400) return false;
    if (isTitleGeneration(row)) return false;
    if (!apiFingerprint(row)) return false;
    return true;
  });
  const collapsed: CaptureSummary[] = [];
  for (const row of useful) {
    const previous = collapsed[collapsed.length - 1];
    if (previous && shouldCollapse(previous, row)) {
      collapsed[collapsed.length - 1] = preferCapture(previous, row);
    } else {
      collapsed.push(row);
    }
  }
  return collapsed;
}

function isTitleGeneration(row: CaptureSummary) {
  return Boolean(row.systemText?.includes("Generate a concise, sentence-case title"));
}

function shouldCollapse(a: CaptureSummary, b: CaptureSummary) {
  const delta = Math.abs(new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  if (delta > 15000) return false;
  return apiFingerprint(a) === apiFingerprint(b);
}

function preferCapture(a: CaptureSummary, b: CaptureSummary) {
  if (!b.stream && a.stream) return b;
  if (b.assistantText && !a.assistantText) return b;
  return b.durationMs && a.durationMs && b.durationMs > a.durationMs ? a : b;
}

function normalizeText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, "").replace(/[，。！？!?.,]/g, "");
}

function apiFingerprint(row: CaptureSummary) {
  const request = row.requestJson ?? "";
  if (!request.trim()) return "";
  try {
    return stableStringify(JSON.parse(request));
  } catch {
    return request;
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function storedNumber(key: string, fallback: number, min = 280, max = 620) {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function storedBoolean(key: string, fallback: boolean) {
  const value = window.localStorage.getItem(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function storedTheme(): ThemeMode {
  return window.localStorage.getItem("agent-charles-theme") === "dark" ? "dark" : "light";
}

function storedTab() {
  const value = window.localStorage.getItem("agent-charles-detail-tab");
  return ["messages", "content", "stream", "headers"].includes(value ?? "") ? value as string : "messages";
}

createRoot(document.getElementById("root")!).render(<App />);
