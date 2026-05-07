# Agent Charles

Lokaler AI agent API Capture Proxy mit einer Charles-artigen Web UI.

Language: [English](README.md)

## Funktionen

- Lokaler Proxy unter `http://127.0.0.1:4317`.
- Web UI unter `http://127.0.0.1:4317`.
- Erfasst AI agent API-Aufrufe über den lokalen Proxy.
- Speichert request JSON, response JSON, SSE stream Events, extrahierte Nachrichten, Status, Dauer, Modell und token usage.
- Konfiguration von `base_url`, `api_key`, API-Version, auth header und agent integrations in der UI.

## Installation

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

Öffne `http://127.0.0.1:4317`.

## Erste Nutzung

1. UI öffnen.
2. In `LLM-Anbieter` `Base URL` und `API Key` setzen; `Default Model` ist optional.
3. `Anbieter speichern` klicken.
4. Im passenden agent Panel settings path eintragen und `Start` klicken.
5. Den agent neu starten.

Der echte API key wird nur lokal gespeichert:

```text
~/.agent-charles/agent-charles.db
```

Bei `Stop` stellt Agent Charles die Konfiguration aus dem backup wieder her.
