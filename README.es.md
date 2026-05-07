# Agent Charles

Proxy local para capturar API de AI agent con una Web UI estilo Charles.

Language: [English](README.md)

## Funciones

- Ejecuta un proxy local en `http://127.0.0.1:4317`.
- Sirve la Web UI en `http://127.0.0.1:4317`.
- Captura llamadas API de AI agent mediante el proxy local.
- Registra request JSON, response JSON, eventos SSE stream, mensajes extraídos, estado, duración, modelo y uso de token.
- Permite configurar `base_url`, `api_key`, versión API, auth header e integraciones agent desde la UI.

## Instalar

```bash
npm install
```

## Compilar

```bash
npm run build
```

## Iniciar

```bash
npm start
```

Abre `http://127.0.0.1:4317`.

## Primer uso

1. Abre la UI.
2. En `Proveedor LLM`, configura `Base URL`, `API Key`; `Default Model` es opcional.
3. Pulsa `Guardar proveedor`.
4. En el panel del agent, completa settings path y pulsa `Start`.
5. Reinicia el agent.

La API key real se guarda solo en la base local:

```text
~/.agent-charles/agent-charles.db
```

Al pulsar `Stop`, Agent Charles restaura el archivo de configuración desde el backup.
