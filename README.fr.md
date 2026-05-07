# Agent Charles

Proxy local de capture API pour AI agent avec une Web UI façon Charles.

Language: [English](README.md)

## Fonctionnalités

- Proxy local sur `http://127.0.0.1:4317`.
- Web UI sur `http://127.0.0.1:4317`.
- Capture les appels API de AI agent via le proxy local.
- Enregistre request JSON, response JSON, événements SSE stream, messages extraits, statut, durée, modèle et usage token.
- Permet de configurer `base_url`, `api_key`, version API, auth header et intégrations agent depuis l'UI.

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Démarrage

```bash
npm start
```

Ouvrir `http://127.0.0.1:4317`.

## Première utilisation

1. Ouvrir l'UI.
2. Dans `Fournisseur LLM`, définir `Base URL`, `API Key`; `Default Model` est optionnel.
3. Cliquer sur `Enregistrer le fournisseur`.
4. Dans le panneau agent, renseigner settings path puis cliquer sur `Start`.
5. Redémarrer l'agent.

La vraie API key est stockée seulement localement :

```text
~/.agent-charles/agent-charles.db
```

Avec `Stop`, Agent Charles restaure le fichier de configuration depuis le backup.
