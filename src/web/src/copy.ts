export const copy = {
  app: {
    title: "Agent Charles",
    subtitle: "AI Agent Messages API capture"
  },
  actions: {
    clear: "Clear",
    start: "Start",
    stop: "Stop",
    saveProvider: "Save Provider",
    showAdvanced: "Show Advanced",
    hideAdvanced: "Hide Advanced"
  },
  labels: {
    searchCaptures: "Search captures",
    conversations: "Conversations",
    apiCalls: "API Calls",
    unknownModel: "unknown model",
    streamType: "stream",
    jsonType: "json",
    noCaptures: "No captures yet",
    waitingForTraffic: "Waiting for traffic",
    configureAndStart: "Configure provider, then start AI agent capture",
    noCaptureSelected: "Start AI agent traffic to see captures here.",
    noMessages: "No extracted text messages.",
    noStreamEvents: "No stream events.",
    requestHeaders: "Request headers",
    responseHeaders: "Response headers",
    request: "Request",
    response: "Response",
    url: "URL",
    requested: "Requested",
    duration: "Duration",
    body: "Body",
    llmProvider: "LLM Provider",
    baseUrl: "Base URL",
    apiKey: "API Key",
    defaultModel: "Default Model",
    apiVersion: "API Version",
    authHeader: "Auth Header",
    settingsPath: "Settings Path",
    backup: "Backup",
    currentBaseUrl: "Current base URL",
    recording: "Recording",
    stopped: "Stopped",
    manual: "Manual",
    saved: "Saved",
    required: "Required",
    available: "available",
    notFound: "not found",
    notSet: "not set",
    setPathFirst: "set a settings path first"
  },
  tabs: {
    messages: "messages",
    content: "content",
    stream: "stream",
    headers: "headers"
  },
  placeholders: {
    agentSettingsPath: {
      "claude-code": "Path to settings.json",
      "codex-cli": "Path to config.toml",
      "openai-codex": "Path to config.toml",
      openclaw: "Path to openclaw.json",
      hermes: "Path to .clanker.yaml"
    } as Record<string, string>,
    fallbackSettingsPath: "Path to settings file"
  },
  tooltips: {
    clearCaptures: "Clear captures",
    resizeCaptures: "Drag to resize captures",
    resizeSettings: "Drag to resize settings",
    switchToLight: "Switch to light mode",
    switchToDark: "Switch to dark mode",
    expandSettings: "Expand settings",
    collapseSettings: "Collapse settings",
    saveSettingsPath: "Save settings path"
  },
  notices: {
    providerSaved: "Provider config saved",
    claudeStarted: "Claude Code capture started. Previous settings were backed up. Restart Claude Code to pick up settings.",
    claudeStoppedRestored: "Claude Code capture stopped. Settings were restored from backup.",
    claudeStoppedNoBackup: "Claude Code capture stopped. No backup was found, so Agent Charles removed only its own proxy settings.",
    claudePathSaved: "Claude Code settings path saved.",
    agentPathSaved: (agentName: string) => `${agentName} settings path saved.`,
    agentStarted: (agentName: string) => `${agentName} integration started.`,
    agentStopped: (agentName: string) => `${agentName} integration stopped.`
  },
  confirms: {
    startClaude: "Start Claude Code capture? Agent Charles will back up your current Claude Code settings, then write the local proxy settings. Restart Claude Code after starting.",
    stopClaude: "Stop Claude Code capture? Agent Charles will restore the settings backup created before starting.",
    clearCaptures: "Clear all captured requests? This cannot be undone."
  },
  errors: {
    settingsPathRequired: (agentName: string) => `${agentName} settings path is required before starting.`,
    emptyResponseBody: "Response body is empty.",
    emptyStreamResponse: "Stream response is empty.",
    noResponseBody: "Agent Charles did not receive a response body for this request.",
    noStreamEvents: "Agent Charles did not receive stream events or assistant text for this request."
  },
  units: {
    tokens: "tokens",
    chars: "chars",
    bytes: "bytes"
  }
};
