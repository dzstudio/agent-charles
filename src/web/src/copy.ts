type CopyShape = {
  app: { title: string; subtitle: string };
  actions: Record<"clear" | "start" | "stop" | "saveProvider" | "showAdvanced" | "hideAdvanced", string>;
  labels: Record<string, string>;
  tabs: Record<"messages" | "content" | "stream" | "headers", string>;
  placeholders: { agentSettingsPath: Record<string, string>; fallbackSettingsPath: string };
  tooltips: Record<string, string>;
  notices: {
    providerSaved: string;
    claudeStarted: string;
    claudeStoppedRestored: string;
    claudeStoppedNoBackup: string;
    claudePathSaved: string;
    agentPathSaved: (agentName: string) => string;
    agentStarted: (agentName: string) => string;
    agentStopped: (agentName: string) => string;
  };
  confirms: Record<"startClaude" | "stopClaude" | "clearCaptures", string>;
  errors: {
    settingsPathRequired: (agentName: string) => string;
    emptyResponseBody: string;
    emptyStreamResponse: string;
    noResponseBody: string;
    noStreamEvents: string;
  };
  units: Record<"tokens" | "chars" | "bytes", string>;
};

export type LanguageCode = "en" | "zh" | "ru" | "es" | "ar" | "de" | "fr" | "it" | "pt" | "ja" | "ko";

export const languageOptions: Array<{ code: LanguageCode; label: string; dir?: "rtl" }> = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "ru", label: "Русский" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" }
];

const en: CopyShape = {
  app: { title: "Agent Charles", subtitle: "AI Agent Messages API capture" },
  actions: { clear: "Clear", start: "Start", stop: "Stop", saveProvider: "Save Provider", showAdvanced: "Show Advanced", hideAdvanced: "Hide Advanced" },
  labels: {
    searchCaptures: "Search captures", conversations: "Conversations", apiCalls: "API Calls", unknownModel: "unknown model", streamType: "stream", jsonType: "json", noCaptures: "No captures yet", waitingForTraffic: "Waiting for traffic", configureAndStart: "Configure provider, then start AI agent capture", noCaptureSelected: "Start AI agent traffic to see captures here.", noMessages: "No extracted text messages.", noStreamEvents: "No stream events.", requestHeaders: "Request headers", responseHeaders: "Response headers", request: "Request", response: "Response", url: "URL", requested: "Requested", duration: "Duration", body: "Body", llmProvider: "LLM Provider", baseUrl: "Base URL", apiKey: "API Key", defaultModel: "Default Model", apiVersion: "API Version", authHeader: "Auth Header", settingsPath: "Settings Path", backup: "Backup", currentBaseUrl: "Current base URL", recording: "Recording", stopped: "Stopped", manual: "Manual", saved: "Saved", required: "Required", available: "available", notFound: "not found", notSet: "not set", setPathFirst: "set a settings path first"
  },
  tabs: { messages: "messages", content: "content", stream: "stream", headers: "headers" },
  placeholders: { agentSettingsPath: { "claude-code": "Path to settings.json", "codex-cli": "Path to config.toml", "openai-codex": "Path to config.toml", openclaw: "Path to openclaw.json", hermes: "Path to .clanker.yaml" }, fallbackSettingsPath: "Path to settings file" },
  tooltips: { clearCaptures: "Clear captures", resizeCaptures: "Drag to resize captures", resizeSettings: "Drag to resize settings", switchToLight: "Switch to light mode", switchToDark: "Switch to dark mode", expandSettings: "Expand settings", collapseSettings: "Collapse settings", saveSettingsPath: "Save settings path", language: "Language" },
  notices: { providerSaved: "Provider config saved", claudeStarted: "Claude Code capture started. Previous settings were backed up. Restart Claude Code to pick up settings.", claudeStoppedRestored: "Claude Code capture stopped. Settings were restored from backup.", claudeStoppedNoBackup: "Claude Code capture stopped. No backup was found, so Agent Charles removed only its own proxy settings.", claudePathSaved: "Claude Code settings path saved.", agentPathSaved: (agentName) => `${agentName} settings path saved.`, agentStarted: (agentName) => `${agentName} integration started.`, agentStopped: (agentName) => `${agentName} integration stopped.` },
  confirms: { startClaude: "Start Claude Code capture? Agent Charles will back up your current Claude Code settings, then write the local proxy settings. Restart Claude Code after starting.", stopClaude: "Stop Claude Code capture? Agent Charles will restore the settings backup created before starting.", clearCaptures: "Clear all captured requests? This cannot be undone." },
  errors: { settingsPathRequired: (agentName) => `${agentName} settings path is required before starting.`, emptyResponseBody: "Response body is empty.", emptyStreamResponse: "Stream response is empty.", noResponseBody: "Agent Charles did not receive a response body for this request.", noStreamEvents: "Agent Charles did not receive stream events or assistant text for this request." },
  units: { tokens: "tokens", chars: "chars", bytes: "bytes" }
};

type CopyOverride = Omit<Partial<CopyShape>, "notices" | "errors" | "placeholders"> & {
  notices?: Partial<Omit<CopyShape["notices"], "agentPathSaved" | "agentStarted" | "agentStopped">> & Pick<CopyShape["notices"], "agentPathSaved" | "agentStarted" | "agentStopped">;
  errors?: Partial<Omit<CopyShape["errors"], "settingsPathRequired">> & Pick<CopyShape["errors"], "settingsPathRequired">;
  placeholders?: { agentSettingsPath?: Record<string, string>; fallbackSettingsPath?: string };
};

function define(overrides: CopyOverride): CopyShape {
  return {
    ...en,
    ...overrides,
    app: { ...en.app, ...overrides.app },
    actions: { ...en.actions, ...overrides.actions },
    labels: { ...en.labels, ...overrides.labels },
    tabs: { ...en.tabs, ...overrides.tabs },
    placeholders: {
      agentSettingsPath: { ...en.placeholders.agentSettingsPath, ...overrides.placeholders?.agentSettingsPath },
      fallbackSettingsPath: overrides.placeholders?.fallbackSettingsPath ?? en.placeholders.fallbackSettingsPath
    },
    tooltips: { ...en.tooltips, ...overrides.tooltips },
    notices: { ...en.notices, ...overrides.notices },
    confirms: { ...en.confirms, ...overrides.confirms },
    errors: { ...en.errors, ...overrides.errors },
    units: { ...en.units, ...overrides.units }
  };
}

const locales: Record<LanguageCode, CopyShape> = {
  en,
  zh: define({
    app: { subtitle: "AI Agent 消息 API 抓包" },
    actions: { clear: "清空", start: "开始", stop: "停止", saveProvider: "保存提供方", showAdvanced: "显示高级", hideAdvanced: "隐藏高级" },
    labels: { searchCaptures: "搜索抓包", conversations: "对话", apiCalls: "API 调用", unknownModel: "未知模型", streamType: "流式", jsonType: "JSON", noCaptures: "暂无抓包记录", waitingForTraffic: "等待流量", configureAndStart: "配置模型提供方，然后开始 AI agent 抓包", noCaptureSelected: "启动 AI agent 流量后在这里查看抓包。", noMessages: "没有提取到文本消息。", noStreamEvents: "没有 stream 事件。", requestHeaders: "请求头", responseHeaders: "响应头", request: "请求", response: "响应", requested: "请求时间", duration: "耗时", body: "Body", llmProvider: "大模型提供方", defaultModel: "默认模型", apiVersion: "API 版本", authHeader: "认证 Header", settingsPath: "配置路径", backup: "备份", currentBaseUrl: "当前 Base URL", recording: "录制中", stopped: "已停止", manual: "手动", saved: "已保存", required: "必填", available: "可用", notFound: "未找到", notSet: "未设置", setPathFirst: "请先设置路径" },
    tabs: { messages: "消息", content: "内容", stream: "Stream", headers: "Headers" },
    placeholders: { agentSettingsPath: { "claude-code": "settings.json 路径", "codex-cli": "config.toml 路径", "openai-codex": "config.toml 路径", openclaw: "openclaw.json 路径", hermes: ".clanker.yaml 路径" }, fallbackSettingsPath: "配置文件路径" },
    tooltips: { clearCaptures: "清空抓包", resizeCaptures: "拖拽调整抓包列表宽度", resizeSettings: "拖拽调整设置宽度", switchToLight: "切换到浅色模式", switchToDark: "切换到深色模式", expandSettings: "展开设置", collapseSettings: "收起设置", saveSettingsPath: "保存配置路径", language: "语言" },
    notices: { providerSaved: "提供方配置已保存", claudeStarted: "Claude Code 抓包已开始。已备份原设置。请重启 Claude Code 使设置生效。", claudeStoppedRestored: "Claude Code 抓包已停止。设置已从备份恢复。", claudeStoppedNoBackup: "Claude Code 抓包已停止。未找到备份，仅移除了 Agent Charles 代理设置。", claudePathSaved: "Claude Code 配置路径已保存。", agentPathSaved: (n) => `${n} 配置路径已保存。`, agentStarted: (n) => `${n} 集成已开始。`, agentStopped: (n) => `${n} 集成已停止。` },
    confirms: { startClaude: "开始 Claude Code 抓包？Agent Charles 将备份当前 Claude Code 设置，然后写入本地代理设置。开始后请重启 Claude Code。", stopClaude: "停止 Claude Code 抓包？Agent Charles 将恢复开始前创建的设置备份。", clearCaptures: "清空所有抓包记录？此操作不可撤销。" },
    errors: { settingsPathRequired: (n) => `开始前需要填写 ${n} 的配置路径。`, emptyResponseBody: "响应 body 为空。", emptyStreamResponse: "Stream 响应为空。", noResponseBody: "Agent Charles 未收到此请求的响应 body。", noStreamEvents: "Agent Charles 未收到 stream 事件或 assistant 文本。" },
    units: { tokens: "tokens", chars: "字符", bytes: "bytes" }
  }),
  ru: define({ labels: { searchCaptures: "Поиск", conversations: "Диалоги", apiCalls: "API вызовы", noCaptures: "Записей нет", waitingForTraffic: "Ожидание трафика", configureAndStart: "Настройте поставщика, затем запустите захват AI agent", noCaptureSelected: "Запустите трафик AI agent, чтобы увидеть записи.", request: "Запрос", llmProvider: "Поставщик LLM", response: "Ответ", requested: "Время", duration: "Длительность", recording: "Запись", stopped: "Остановлено", backup: "Резервная копия", settingsPath: "Путь настроек", currentBaseUrl: "Текущий Base URL", available: "доступно", notFound: "не найдено", notSet: "не задано" }, actions: { clear: "Очистить", start: "Старт", stop: "Стоп", saveProvider: "Сохранить поставщика", showAdvanced: "Показать доп.", hideAdvanced: "Скрыть доп." }, tabs: { messages: "сообщения", content: "контент", stream: "stream", headers: "headers" }, notices: { providerSaved: "Поставщик сохранён", agentPathSaved: (n) => `Путь настроек ${n} сохранён.`, agentStarted: (n) => `Интеграция ${n} запущена.`, agentStopped: (n) => `Интеграция ${n} остановлена.` }, errors: { settingsPathRequired: (n) => `Укажите путь настроек ${n} перед запуском.` } }),
  es: define({ labels: { searchCaptures: "Buscar capturas", conversations: "Conversaciones", apiCalls: "Llamadas API", noCaptures: "Sin capturas", waitingForTraffic: "Esperando tráfico", configureAndStart: "Configura el proveedor y luego inicia la captura de AI agent", noCaptureSelected: "Inicia tráfico de AI agent para ver capturas.", request: "Solicitud", llmProvider: "Proveedor LLM", response: "Respuesta", requested: "Hora", duration: "Duración", recording: "Grabando", stopped: "Detenido", backup: "Copia", settingsPath: "Ruta de ajustes", currentBaseUrl: "Base URL actual", available: "disponible", notFound: "no encontrado", notSet: "sin definir" }, actions: { clear: "Limpiar", start: "Iniciar", stop: "Detener", saveProvider: "Guardar proveedor", showAdvanced: "Mostrar avanzado", hideAdvanced: "Ocultar avanzado" }, tabs: { messages: "mensajes", content: "contenido", stream: "stream", headers: "headers" }, notices: { providerSaved: "Proveedor guardado", agentPathSaved: (n) => `Ruta de ajustes de ${n} guardada.`, agentStarted: (n) => `Integración de ${n} iniciada.`, agentStopped: (n) => `Integración de ${n} detenida.` }, errors: { settingsPathRequired: (n) => `La ruta de ajustes de ${n} es obligatoria antes de iniciar.` } }),
  ar: define({ labels: { searchCaptures: "بحث", conversations: "المحادثات", apiCalls: "استدعاءات API", noCaptures: "لا توجد سجلات", waitingForTraffic: "بانتظار البيانات", configureAndStart: "اضبط المزود ثم ابدأ التقاط AI agent", noCaptureSelected: "ابدأ مرور AI agent لعرض السجلات.", request: "الطلب", llmProvider: "مزود LLM", response: "الاستجابة", requested: "وقت الطلب", duration: "المدة", recording: "تسجيل", stopped: "متوقف", backup: "نسخة احتياطية", settingsPath: "مسار الإعدادات", currentBaseUrl: "Base URL الحالي", available: "متاح", notFound: "غير موجود", notSet: "غير محدد" }, actions: { clear: "مسح", start: "بدء", stop: "إيقاف", saveProvider: "حفظ المزود", showAdvanced: "إظهار المتقدم", hideAdvanced: "إخفاء المتقدم" }, tabs: { messages: "الرسائل", content: "المحتوى", stream: "stream", headers: "headers" }, notices: { providerSaved: "تم حفظ إعدادات المزود", agentPathSaved: (n) => `تم حفظ مسار إعدادات ${n}.`, agentStarted: (n) => `تم بدء تكامل ${n}.`, agentStopped: (n) => `تم إيقاف تكامل ${n}.` }, errors: { settingsPathRequired: (n) => `مسار إعدادات ${n} مطلوب قبل البدء.` } }),
  de: define({ labels: { searchCaptures: "Captures suchen", conversations: "Konversationen", apiCalls: "API-Aufrufe", noCaptures: "Keine Captures", waitingForTraffic: "Warte auf Traffic", configureAndStart: "Anbieter konfigurieren, dann AI agent Capture starten", noCaptureSelected: "Starte AI agent Traffic, um Captures zu sehen.", request: "Anfrage", llmProvider: "LLM-Anbieter", response: "Antwort", requested: "Angefragt", duration: "Dauer", recording: "Aufnahme", stopped: "Gestoppt", backup: "Backup", settingsPath: "Einstellungspfad", currentBaseUrl: "Aktuelle Base URL", available: "verfügbar", notFound: "nicht gefunden", notSet: "nicht gesetzt" }, actions: { clear: "Leeren", start: "Start", stop: "Stopp", saveProvider: "Anbieter speichern", showAdvanced: "Erweitert anzeigen", hideAdvanced: "Erweitert ausblenden" }, tabs: { messages: "Nachrichten", content: "Inhalt", stream: "Stream", headers: "Headers" }, notices: { providerSaved: "Anbieter gespeichert", agentPathSaved: (n) => `${n} Einstellungspfad gespeichert.`, agentStarted: (n) => `${n} Integration gestartet.`, agentStopped: (n) => `${n} Integration gestoppt.` }, errors: { settingsPathRequired: (n) => `${n} Einstellungspfad ist vor dem Start erforderlich.` } }),
  fr: define({ labels: { searchCaptures: "Rechercher", conversations: "Conversations", apiCalls: "Appels API", noCaptures: "Aucune capture", waitingForTraffic: "En attente de trafic", configureAndStart: "Configurez le fournisseur, puis démarrez la capture AI agent", noCaptureSelected: "Lancez le trafic AI agent pour voir les captures.", request: "Requête", llmProvider: "Fournisseur LLM", response: "Réponse", requested: "Demandé", duration: "Durée", recording: "Enregistrement", stopped: "Arrêté", backup: "Sauvegarde", settingsPath: "Chemin des paramètres", currentBaseUrl: "Base URL actuelle", available: "disponible", notFound: "introuvable", notSet: "non défini" }, actions: { clear: "Effacer", start: "Démarrer", stop: "Arrêter", saveProvider: "Enregistrer le fournisseur", showAdvanced: "Afficher avancé", hideAdvanced: "Masquer avancé" }, tabs: { messages: "messages", content: "contenu", stream: "stream", headers: "headers" }, notices: { providerSaved: "Fournisseur enregistré", agentPathSaved: (n) => `Chemin des paramètres ${n} enregistré.`, agentStarted: (n) => `Intégration ${n} démarrée.`, agentStopped: (n) => `Intégration ${n} arrêtée.` }, errors: { settingsPathRequired: (n) => `Le chemin des paramètres ${n} est requis avant le démarrage.` } }),
  it: define({ labels: { searchCaptures: "Cerca capture", conversations: "Conversazioni", apiCalls: "Chiamate API", noCaptures: "Nessuna capture", waitingForTraffic: "In attesa di traffico", configureAndStart: "Configura il fornitore, poi avvia la cattura AI agent", noCaptureSelected: "Avvia traffico AI agent per vedere le capture.", request: "Richiesta", llmProvider: "Fornitore LLM", response: "Risposta", requested: "Richiesto", duration: "Durata", recording: "Registrazione", stopped: "Fermato", backup: "Backup", settingsPath: "Percorso impostazioni", currentBaseUrl: "Base URL attuale", available: "disponibile", notFound: "non trovato", notSet: "non impostato" }, actions: { clear: "Pulisci", start: "Avvia", stop: "Ferma", saveProvider: "Salva fornitore", showAdvanced: "Mostra avanzate", hideAdvanced: "Nascondi avanzate" }, tabs: { messages: "messaggi", content: "contenuto", stream: "stream", headers: "headers" }, notices: { providerSaved: "Fornitore salvato", agentPathSaved: (n) => `Percorso impostazioni ${n} salvato.`, agentStarted: (n) => `Integrazione ${n} avviata.`, agentStopped: (n) => `Integrazione ${n} fermata.` }, errors: { settingsPathRequired: (n) => `Il percorso impostazioni di ${n} è richiesto prima dell'avvio.` } }),
  pt: define({ labels: { searchCaptures: "Buscar capturas", conversations: "Conversas", apiCalls: "Chamadas API", noCaptures: "Sem capturas", waitingForTraffic: "Aguardando tráfego", configureAndStart: "Configure o provedor e inicie a captura do AI agent", noCaptureSelected: "Inicie o tráfego do AI agent para ver capturas.", request: "Requisição", llmProvider: "Provedor LLM", response: "Resposta", requested: "Solicitado", duration: "Duração", recording: "Gravando", stopped: "Parado", backup: "Backup", settingsPath: "Caminho de configurações", currentBaseUrl: "Base URL atual", available: "disponível", notFound: "não encontrado", notSet: "não definido" }, actions: { clear: "Limpar", start: "Iniciar", stop: "Parar", saveProvider: "Salvar provedor", showAdvanced: "Mostrar avançado", hideAdvanced: "Ocultar avançado" }, tabs: { messages: "mensagens", content: "conteúdo", stream: "stream", headers: "headers" }, notices: { providerSaved: "Provedor salvo", agentPathSaved: (n) => `Caminho de configurações de ${n} salvo.`, agentStarted: (n) => `Integração ${n} iniciada.`, agentStopped: (n) => `Integração ${n} parada.` }, errors: { settingsPathRequired: (n) => `O caminho de configurações de ${n} é obrigatório antes de iniciar.` } }),
  ja: define({ labels: { searchCaptures: "キャプチャ検索", conversations: "会話", apiCalls: "API 呼び出し", noCaptures: "キャプチャはありません", waitingForTraffic: "トラフィック待機中", configureAndStart: "プロバイダーを設定してから AI agent キャプチャを開始", noCaptureSelected: "AI agent のトラフィックを開始するとここに表示されます。", request: "リクエスト", llmProvider: "LLM プロバイダー", response: "レスポンス", requested: "リクエスト時刻", duration: "時間", recording: "記録中", stopped: "停止中", backup: "バックアップ", settingsPath: "設定パス", currentBaseUrl: "現在の Base URL", available: "あり", notFound: "なし", notSet: "未設定" }, actions: { clear: "クリア", start: "開始", stop: "停止", saveProvider: "プロバイダーを保存", showAdvanced: "詳細を表示", hideAdvanced: "詳細を隠す" }, tabs: { messages: "メッセージ", content: "内容", stream: "stream", headers: "headers" }, notices: { providerSaved: "プロバイダー設定を保存しました", agentPathSaved: (n) => `${n} の設定パスを保存しました。`, agentStarted: (n) => `${n} 連携を開始しました。`, agentStopped: (n) => `${n} 連携を停止しました。` }, errors: { settingsPathRequired: (n) => `開始前に ${n} の設定パスが必要です。` } }),
  ko: define({ labels: { searchCaptures: "캡처 검색", conversations: "대화", apiCalls: "API 호출", noCaptures: "캡처 없음", waitingForTraffic: "트래픽 대기 중", configureAndStart: "제공자를 설정한 다음 AI agent 캡처를 시작하세요", noCaptureSelected: "AI agent 트래픽을 시작하면 여기에 캡처가 표시됩니다.", request: "요청", llmProvider: "LLM 제공자", response: "응답", requested: "요청 시간", duration: "소요 시간", recording: "기록 중", stopped: "중지됨", backup: "백업", settingsPath: "설정 경로", currentBaseUrl: "현재 Base URL", available: "사용 가능", notFound: "없음", notSet: "미설정" }, actions: { clear: "지우기", start: "시작", stop: "중지", saveProvider: "제공자 저장", showAdvanced: "고급 표시", hideAdvanced: "고급 숨기기" }, tabs: { messages: "메시지", content: "내용", stream: "stream", headers: "headers" }, notices: { providerSaved: "제공자 설정이 저장되었습니다", agentPathSaved: (n) => `${n} 설정 경로가 저장되었습니다.`, agentStarted: (n) => `${n} 통합이 시작되었습니다.`, agentStopped: (n) => `${n} 통합이 중지되었습니다.` }, errors: { settingsPathRequired: (n) => `시작하기 전에 ${n} 설정 경로가 필요합니다.` } })
};

export let copy: CopyShape = en;

export function setCopyLanguage(language: LanguageCode) {
  copy = locales[language] ?? en;
  const option = languageOptions.find((item) => item.code === language);
  document.documentElement.lang = language;
  document.documentElement.dir = option?.dir ?? "ltr";
}

export function storedLanguage(): LanguageCode {
  const value = window.localStorage.getItem("agent-charles-language") as LanguageCode | null;
  return languageOptions.some((item) => item.code === value) ? value as LanguageCode : "en";
}
