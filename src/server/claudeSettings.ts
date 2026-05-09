import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const defaultClaudeSettingsPath = join(homedir(), ".claude", "settings.json");

export function normalizeClaudeSettingsPath(settingsPath: string) {
  const trimmed = settingsPath.trim();
  if (!trimmed) return defaultClaudeSettingsPath;
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) return join(homedir(), trimmed.slice(2));
  return resolve(trimmed);
}

export function claudeBackupPath(settingsPath: string) {
  if (!settingsPath) return "";
  return join(dirname(settingsPath), "settings.agent-charles.backup.json");
}

export function getClaudeIntegrationStatus(proxyUrl: string, configuredSettingsPath?: string | null) {
  const settingsPath = configuredSettingsPath
    ? normalizeClaudeSettingsPath(configuredSettingsPath)
    : existsSync(defaultClaudeSettingsPath) ? defaultClaudeSettingsPath : "";
  const backupPath = claudeBackupPath(settingsPath);
  const settings = readSettings(settingsPath);
  const env = isRecord(settings.env) ? settings.env : {};
  return {
    settingsPath,
    backupPath,
    enabled: env.ANTHROPIC_BASE_URL === proxyUrl,
    currentBaseUrl: typeof env.ANTHROPIC_BASE_URL === "string" ? env.ANTHROPIC_BASE_URL : "",
    hasBackup: existsSync(backupPath)
  };
}

export function enableClaudeIntegration(proxyUrl: string, configuredSettingsPath?: string | null) {
  const settingsPath = normalizeClaudeSettingsPath(configuredSettingsPath ?? defaultClaudeSettingsPath);
  const backupPath = claudeBackupPath(settingsPath);
  mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });
  const status = getClaudeIntegrationStatus(proxyUrl, settingsPath);
  if (!status.enabled) {
    if (existsSync(settingsPath)) {
      copyFileSync(settingsPath, backupPath);
    } else {
      writeFileSync(backupPath, "{}\n", { mode: 0o600 });
    }
  }
  const settings = readSettings(settingsPath);
  const env = isRecord(settings.env) ? { ...settings.env } : {};
  env.ANTHROPIC_BASE_URL = proxyUrl;
  settings.env = env;
  writeSettings(settingsPath, settings);
  return getClaudeIntegrationStatus(proxyUrl, settingsPath);
}

export function disableClaudeIntegration(proxyUrl: string, configuredSettingsPath?: string | null) {
  const settingsPath = normalizeClaudeSettingsPath(configuredSettingsPath ?? defaultClaudeSettingsPath);
  const backupPath = claudeBackupPath(settingsPath);
  if (existsSync(backupPath)) {
    copyFileSync(backupPath, settingsPath);
  } else {
    const settings = readSettings(settingsPath);
    if (isRecord(settings.env)) {
      const env = { ...settings.env };
      if (env.ANTHROPIC_BASE_URL === proxyUrl) delete env.ANTHROPIC_BASE_URL;
      settings.env = env;
    }
    writeSettings(settingsPath, settings);
  }
  return getClaudeIntegrationStatus(proxyUrl, settingsPath);
}

function readSettings(settingsPath: string): Record<string, unknown> {
  if (!existsSync(settingsPath)) return {};
  try {
    const text = readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeSettings(settingsPath: string, settings: Record<string, unknown>) {
  mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
