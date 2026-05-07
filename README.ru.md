# Agent Charles

Локальный прокси для захвата API вызовов AI agent с Web UI в стиле Charles.

Language: [English](README.md)

## Возможности

- Локальный прокси: `http://127.0.0.1:4317`.
- Web UI: `http://127.0.0.1:4317`.
- Захват API вызовов AI agent через локальный прокси.
- Запись request JSON, response JSON, SSE stream событий, сообщений, статуса, длительности, модели и token usage.
- Настройка `base_url`, `api_key`, версии API, auth header и интеграций agent из UI.

## Установка

```bash
npm install
```

## Сборка

```bash
npm run build
```

## Запуск

```bash
npm start
```

Откройте `http://127.0.0.1:4317`.

## Первый запуск

1. Откройте UI.
2. В `Поставщик LLM` задайте `Base URL`, `API Key`; `Default Model` необязателен.
3. Нажмите `Сохранить поставщика`.
4. В панели нужного agent укажите settings path и нажмите `Start`.
5. Перезапустите agent.

API key хранится только в локальной базе Agent Charles:

```text
~/.agent-charles/agent-charles.db
```

При `Stop` Agent Charles восстанавливает файл настроек из backup.
