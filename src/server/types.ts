export type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  authHeader: "x-api-key" | "authorization";
  defaultModel: string;
  extraHeaders: Record<string, string>;
};

export type CaptureSummary = {
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
