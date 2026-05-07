# Agent Charles

Proxy local de captura de API de AI agent com uma Web UI estilo Charles.

Language: [English](README.md)

## Recursos

- Proxy local em `http://127.0.0.1:4317`.
- Web UI em `http://127.0.0.1:4317`.
- Captura chamadas API de AI agent pelo proxy local.
- Registra request JSON, response JSON, eventos SSE stream, mensagens extraídas, status, duração, modelo e uso de token.
- Permite configurar `base_url`, `api_key`, versão API, auth header e integrações agent na UI.

## Instalar

```bash
npm install
```

## Build

```bash
npm run build
```

## Iniciar

```bash
npm start
```

Abra `http://127.0.0.1:4317`.

## Primeiro uso

1. Abra a UI.
2. Em `Provedor LLM`, defina `Base URL`, `API Key`; `Default Model` é opcional.
3. Clique em `Salvar provedor`.
4. No painel do agent, preencha settings path e clique em `Start`.
5. Reinicie o agent.

A API key real fica apenas no banco local:

```text
~/.agent-charles/agent-charles.db
```

Ao clicar `Stop`, Agent Charles restaura o arquivo de configuração a partir do backup.
