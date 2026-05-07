import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  claudeBackupPath,
  defaultClaudeSettingsPath,
  disableClaudeIntegration,
  enableClaudeIntegration,
  getClaudeIntegrationStatus,
  normalizeClaudeSettingsPath
} from "./claudeSettings.js";

export type AgentIntegration = {
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

const managedStart = "# agent-charles:start";
const managedEnd = "# agent-charles:end";

export const agentDefinitions = [
  { id: "claude-code", name: "Claude Code", kind: "claude", defaultPath: defaultClaudeSettingsPath, supported: true },
  { id: "codex-cli", name: "CodeX CLI", kind: "codex", defaultPath: join(homedir(), ".codex", "config.toml"), supported: true },
  { id: "openai-codex", name: "OpenAI CodeX", kind: "codex", defaultPath: join(homedir(), ".codex", "config.toml"), supported: true },
  { id: "openclaw", name: "OpenClaw", kind: "openclaw", defaultPath: join(homedir(), ".openclaw", "openclaw.yaml"), supported: true },
  { id: "hermes", name: "Hermes", kind: "hermes", defaultPath: join(homedir(), ".clanker.yaml"), supported: true }
] as const;

export function getAgentIntegration(id: string, proxyUrl: string, configuredPath?: string | null): AgentIntegration {
  const def = agentDefinitions.find((item) => item.id === id);
  if (!def) throw new Error(`Unknown agent: ${id}`);
  if (def.kind === "claude") {
    return {
      id: def.id,
      name: def.name,
      supported: true,
      ...getClaudeIntegrationStatus(proxyUrl, configuredPath ?? def.defaultPath)
    };
  }
  if (def.kind === "codex") {
    const settingsPath = existingOrConfiguredPath(configuredPath, def.defaultPath);
    const backupPath = codexBackupPath(settingsPath, def.id);
    const text = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : "";
    return {
      id: def.id,
      name: def.name,
      supported: true,
      settingsPath,
      backupPath,
      enabled: text.includes(managedStart) && text.includes(`base_url = "${proxyUrl}/v1"`),
      currentBaseUrl: text.includes(managedStart) ? `${proxyUrl}/v1` : "",
      hasBackup: existsSync(backupPath)
    };
  }
  if (def.kind === "openclaw" || def.kind === "hermes") {
    const settingsPath = existingOrConfiguredPath(configuredPath, def.defaultPath);
    const backupPath = yamlBackupPath(settingsPath, def.id);
    const text = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : "";
    return {
      id: def.id,
      name: def.name,
      supported: true,
      settingsPath,
      backupPath,
      enabled: text.includes(managedStart) && text.includes(`base_url: "${proxyUrl}/v1"`),
      currentBaseUrl: text.includes(managedStart) ? `${proxyUrl}/v1` : "",
      hasBackup: existsSync(backupPath),
      notes: def.kind === "openclaw"
        ? "Writes an Agent Charles OpenAI-compatible provider into openclaw.yaml. Restart OpenClaw after changing this."
        : "Writes hermes.base_url into .clanker.yaml. Restart Clanker/Hermes after changing this."
    };
  }
  throw new Error(`Unsupported agent integration: ${id}`);
}

export function enableAgentIntegration(id: string, proxyUrl: string, configuredPath?: string | null) {
  const def = agentDefinitions.find((item) => item.id === id);
  if (!def) throw new Error(`Unknown agent: ${id}`);
  if (def.kind === "claude") return { id: def.id, name: def.name, supported: true, ...enableClaudeIntegration(proxyUrl, configuredPath ?? def.defaultPath) };
  if (def.kind === "codex") {
    const settingsPath = normalizeConfigPath(configuredPath || "");
    assertSettingsPath(settingsPath, def.name);
    const backupPath = codexBackupPath(settingsPath, def.id);
    mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });
    if (!existsSync(backupPath)) {
      writeFileSync(backupPath, existsSync(settingsPath) ? readFileSync(settingsPath) : "");
    }
    const current = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : "";
    writeFileSync(settingsPath, applyCodexManagedBlock(current, proxyUrl), { mode: 0o600 });
    return getAgentIntegration(id, proxyUrl, settingsPath);
  }
  if (def.kind === "openclaw" || def.kind === "hermes") {
    const settingsPath = normalizeConfigPath(configuredPath || "");
    assertSettingsPath(settingsPath, def.name);
    const backupPath = yamlBackupPath(settingsPath, def.id);
    mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });
    if (!existsSync(backupPath)) {
      writeFileSync(backupPath, existsSync(settingsPath) ? readFileSync(settingsPath) : "");
    }
    const current = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : "";
    const next = def.kind === "openclaw"
      ? applyOpenClawManagedBlock(current, proxyUrl)
      : applyHermesManagedBlock(current, proxyUrl);
    writeFileSync(settingsPath, next, { mode: 0o600 });
    return getAgentIntegration(id, proxyUrl, settingsPath);
  }
  return getAgentIntegration(id, proxyUrl, configuredPath);
}

export function disableAgentIntegration(id: string, proxyUrl: string, configuredPath?: string | null) {
  const def = agentDefinitions.find((item) => item.id === id);
  if (!def) throw new Error(`Unknown agent: ${id}`);
  if (def.kind === "claude") return { id: def.id, name: def.name, supported: true, ...disableClaudeIntegration(proxyUrl, configuredPath ?? def.defaultPath) };
  if (def.kind === "codex") {
    const settingsPath = normalizeConfigPath(configuredPath || "");
    assertSettingsPath(settingsPath, def.name);
    const backupPath = codexBackupPath(settingsPath, def.id);
    if (existsSync(backupPath)) {
      copyFileSync(backupPath, settingsPath);
    } else if (existsSync(settingsPath)) {
      writeFileSync(settingsPath, removeCodexManagedBlock(readFileSync(settingsPath, "utf8")), { mode: 0o600 });
    }
    return getAgentIntegration(id, proxyUrl, settingsPath);
  }
  if (def.kind === "openclaw" || def.kind === "hermes") {
    const settingsPath = normalizeConfigPath(configuredPath || "");
    assertSettingsPath(settingsPath, def.name);
    const backupPath = yamlBackupPath(settingsPath, def.id);
    if (existsSync(backupPath)) {
      copyFileSync(backupPath, settingsPath);
    } else if (existsSync(settingsPath)) {
      writeFileSync(settingsPath, removeManagedBlock(readFileSync(settingsPath, "utf8")), { mode: 0o600 });
    }
    return getAgentIntegration(id, proxyUrl, settingsPath);
  }
  return getAgentIntegration(id, proxyUrl, configuredPath);
}

export function normalizeAgentSettingsPath(id: string, settingsPath: string) {
  const def = agentDefinitions.find((item) => item.id === id);
  if (!def) throw new Error(`Unknown agent: ${id}`);
  if (def.kind === "claude") return normalizeClaudeSettingsPath(settingsPath || def.defaultPath);
  return normalizeConfigPath(settingsPath || def.defaultPath);
}

export function backupPathForAgent(id: string, settingsPath: string) {
  const def = agentDefinitions.find((item) => item.id === id);
  if (!def) throw new Error(`Unknown agent: ${id}`);
  if (def.kind === "claude") return claudeBackupPath(settingsPath);
  if (def.kind === "openclaw" || def.kind === "hermes") return yamlBackupPath(settingsPath, id);
  return codexBackupPath(settingsPath, id);
}

function normalizeConfigPath(settingsPath: string) {
  const trimmed = settingsPath.trim();
  if (!trimmed) return trimmed;
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) return join(homedir(), trimmed.slice(2));
  return resolve(trimmed);
}

function existingOrConfiguredPath(configuredPath: string | null | undefined, defaultPath: string) {
  if (configuredPath) return normalizeConfigPath(configuredPath);
  return existsSync(defaultPath) ? normalizeConfigPath(defaultPath) : "";
}

function assertSettingsPath(settingsPath: string, agentName: string) {
  if (!settingsPath) throw new Error(`${agentName} settings path is required before starting.`);
}

function codexBackupPath(settingsPath: string, id: string) {
  if (!settingsPath) return "";
  return join(dirname(settingsPath), `config.agent-charles.${id}.backup.toml`);
}

function yamlBackupPath(settingsPath: string, id: string) {
  if (!settingsPath) return "";
  return join(dirname(settingsPath), `${id}.agent-charles.backup.yaml`);
}

function applyCodexManagedBlock(config: string, proxyUrl: string) {
  const withoutManaged = removeManagedBlock(config).trimEnd();
  const withProvider = setTopLevelString(withoutManaged, "model_provider", "agent-charles");
  const block = [
    managedStart,
    "[model_providers.agent-charles]",
    'name = "Agent Charles"',
    `base_url = "${proxyUrl}/v1"`,
    'wire_api = "responses"',
    "requires_openai_auth = false",
    managedEnd
  ].join("\n");
  return `${withProvider.trimEnd()}\n\n${block}\n`;
}

function removeCodexManagedBlock(config: string) {
  return removeManagedBlock(config);
}

function applyOpenClawManagedBlock(config: string, proxyUrl: string) {
  const withoutManaged = removeManagedBlock(config).trimEnd();
  const block = [
    managedStart,
    "models:",
    "  agent_charles:",
    '    api_key: "agent-charles-placeholder"',
    `    base_url: "${proxyUrl}/v1"`,
    '    default_model: "gpt-4o"',
    "",
    "# To route an OpenClaw agent through Agent Charles, set that agent's model to:",
    "#   agent_charles/gpt-4o",
    managedEnd
  ].join("\n");
  return `${withoutManaged}\n\n${block}\n`;
}

function applyHermesManagedBlock(config: string, proxyUrl: string) {
  const withoutManaged = removeManagedBlock(config).trimEnd();
  const block = [
    managedStart,
    "hermes:",
    '  model: "gpt-4o"',
    `  base_url: "${proxyUrl}/v1"`,
    '  openrouter_api_key: "agent-charles-placeholder"',
    managedEnd
  ].join("\n");
  return `${withoutManaged}\n\n${block}\n`;
}

function removeManagedBlock(config: string) {
  const pattern = new RegExp(`\\n?${escapeRegex(managedStart)}[\\s\\S]*?${escapeRegex(managedEnd)}\\n?`, "g");
  return config.replace(pattern, "\n");
}

function setTopLevelString(config: string, key: string, value: string) {
  const line = `${key} = ${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}\\s*=\\s*["'][^"']*["']\\s*$`, "m");
  if (pattern.test(config)) return config.replace(pattern, line);
  return `${line}\n${config}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
