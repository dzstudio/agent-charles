# Agent Charles

Charles 스타일 Web UI를 제공하는 로컬 AI agent API 캡처 프록시입니다.

Language: [English](README.md)

## 기능

- `http://127.0.0.1:4317` 에서 로컬 프록시를 실행합니다.
- `http://127.0.0.1:4317` 에서 Web UI를 제공합니다.
- 로컬 프록시를 통해 AI agent API 호출을 캡처합니다.
- request JSON, response JSON, SSE stream 이벤트, 추출된 메시지, 상태, 소요 시간, 모델, token 사용량을 기록합니다.
- UI에서 `base_url`, `api_key`, API 버전, auth header, agent 통합을 설정할 수 있습니다.

## 설치

```bash
npm install
```

## 빌드

```bash
npm run build
```

## 시작

```bash
npm start
```

`http://127.0.0.1:4317` 을 엽니다.

## 첫 사용

1. UI를 엽니다.
2. `LLM 제공자` 에서 `Base URL`, `API Key` 를 설정합니다. `Default Model` 은 선택 사항입니다.
3. `제공자 저장`을 클릭합니다.
4. agent 패널에서 settings path 를 입력하고 `Start` 를 클릭합니다.
5. agent 를 다시 시작합니다.

실제 API key 는 로컬 DB에만 저장됩니다.

```text
~/.agent-charles/agent-charles.db
```

`Stop` 을 클릭하면 Agent Charles 가 backup 에서 설정 파일을 복원합니다.
