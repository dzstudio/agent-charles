# Agent Charles

Charles 風の Web UI を備えたローカル AI agent API キャプチャプロキシです。

Language: [English](README.md)

## 機能

- `http://127.0.0.1:4317` でローカルプロキシを起動します。
- `http://127.0.0.1:4317` で Web UI を提供します。
- ローカルプロキシ経由で AI agent API 呼び出しをキャプチャします。
- request JSON、response JSON、SSE stream イベント、抽出メッセージ、ステータス、時間、モデル、token 使用量を記録します。
- UI で `base_url`、`api_key`、API バージョン、auth header、agent 連携を設定できます。

## インストール

```bash
npm install
```

## ビルド

```bash
npm run build
```

## 起動

```bash
npm start
```

`http://127.0.0.1:4317` を開きます。

## 初回利用

1. UI を開きます。
2. `LLM プロバイダー` で `Base URL` と `API Key` を設定します。`Default Model` は任意です。
3. `プロバイダーを保存` をクリックします。
4. agent パネルで settings path を入力し、`Start` をクリックします。
5. agent を再起動します。

実際の API key はローカル DB のみに保存されます。

```text
~/.agent-charles/agent-charles.db
```

`Stop` をクリックすると、Agent Charles は backup から設定ファイルを復元します。
