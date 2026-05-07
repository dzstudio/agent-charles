# Agent Charles

Proxy locale per catturare API di AI agent con Web UI in stile Charles.

Language: [English](README.md)

## Funzioni

- Proxy locale su `http://127.0.0.1:4317`.
- Web UI su `http://127.0.0.1:4317`.
- Cattura chiamate API di AI agent tramite proxy locale.
- Registra request JSON, response JSON, eventi SSE stream, messaggi estratti, stato, durata, modello e uso token.
- Configura `base_url`, `api_key`, versione API, auth header e integrazioni agent dalla UI.

## Installazione

```bash
npm install
```

## Build

```bash
npm run build
```

## Avvio

```bash
npm start
```

Apri `http://127.0.0.1:4317`.

## Primo utilizzo

1. Apri la UI.
2. In `Fornitore LLM`, imposta `Base URL`, `API Key`; `Default Model` è opzionale.
3. Clicca `Salva fornitore`.
4. Nel pannello agent inserisci settings path e clicca `Start`.
5. Riavvia l'agent.

La vera API key è salvata solo localmente:

```text
~/.agent-charles/agent-charles.db
```

Con `Stop`, Agent Charles ripristina il file di configurazione dal backup.
