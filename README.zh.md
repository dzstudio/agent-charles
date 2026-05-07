# Agent Charles

本地 AI agent API 抓包代理，提供类似 Charles 的 Web UI。

语言：[English](README.md)

## 功能

- 在 `http://127.0.0.1:4317` 运行本地代理。
- 在 `http://127.0.0.1:4317` 提供 Web UI。
- 通过本地代理抓取 AI agent API 调用。
- 记录 request JSON、response JSON、SSE stream 事件、提取后的消息、状态、耗时、模型和 token 使用量。
- 可在 UI 中配置上游 `base_url`、`api_key`、API 版本、认证 Header 和 agent 集成。

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

## 启动

```bash
npm start
```

打开：

```text
http://127.0.0.1:4317
```

## 首次使用

1. 打开 UI。
2. 在 `大模型提供方` 中设置 `Base URL`、`API Key`，`Default Model` 可选。
3. 点击 `保存提供方`。
4. 在对应 agent 面板中填写 settings path，然后点击 `Start`。
5. 重启对应 agent，使配置生效。

真实 API key 只保存在 Agent Charles 的本地数据库：

```text
~/.agent-charles/agent-charles.db
```

点击 `Stop` 时，Agent Charles 会从备份恢复对应配置文件。

## 当前范围

- Anthropic Messages API 和 OpenAI-compatible `/v1` 代理流。
- 本地 API key 模式。
- 不做 HTTPS MITM。
- API key 当前保存在 SQLite；后续版本建议使用系统密钥存储。
