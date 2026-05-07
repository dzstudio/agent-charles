# Agent Charles

Local Anthropic Messages API capture proxy with a Charles-style web UI.

## What it does

- Runs a local proxy at `http://127.0.0.1:4317`.
- Serves the web UI at `http://127.0.0.1:4317`.
- Captures Claude Code calls to `/v1/messages`.
- Records request JSON, response JSON, SSE stream events, extracted messages, status, duration, model, and token usage.
- Lets you configure upstream `base_url`, `api_key`, API version, auth header, and Claude Code integration from the UI.

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Start

```bash
npm start
```

Open:

```text
http://127.0.0.1:4317
```

## First Use

1. Open the UI.
2. In `Provider`, set:
   - `Base URL`: usually `https://api.anthropic.com`
   - `API Key`: your Anthropic API key
   - `Default Model`: optional
   - Advanced fields can usually stay at their defaults.
3. Click `Save Provider`.
4. In `Claude Code`, click `Start`.
5. Restart Claude Code so it reloads `~/.claude/settings.json`.

The UI writes this Claude Code env config:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:4317"
  }
}
```

The real API key is stored only in Agent Charles' local database:

```text
~/.agent-charles/agent-charles.db
```

Before enabling, the full `~/.claude/settings.json` file is backed up to:

```text
~/.claude/settings.agent-charles.backup.json
```

When you click `Stop`, Agent Charles restores `~/.claude/settings.json` from that backup and shows a browser alert when it finishes. If no backup is present, it falls back to removing only the Agent Charles proxy env values.

## Development

Run the backend:

```bash
npm run dev:server
```

Run the Vite UI separately:

```bash
npm run dev
```

The Vite dev server runs at `http://127.0.0.1:4318` and proxies `/api` and `/v1` to `http://127.0.0.1:4317`.

## Current Scope

- Anthropic-compatible Messages API only.
- Local API key mode only.
- No HTTPS MITM.
- API key is stored locally in SQLite for the MVP; a later version should use macOS Keychain or another OS secret store.
