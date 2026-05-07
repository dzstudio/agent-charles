# Agent Charles

وكيل محلي لالتقاط API الخاص بـ AI agent مع Web UI بأسلوب Charles.

Language: [English](README.md)

## الميزات

- يشغل وكيلاً محلياً على `http://127.0.0.1:4317`.
- يقدم Web UI على `http://127.0.0.1:4317`.
- يلتقط استدعاءات API الخاصة بـ AI agent عبر الوكيل المحلي.
- يسجل request JSON و response JSON وأحداث SSE stream والرسائل والحالة والمدة والنموذج واستخدام token.
- يسمح بإعداد `base_url` و `api_key` وإصدار API و auth header وتكاملات agent من UI.

## التثبيت

```bash
npm install
```

## البناء

```bash
npm run build
```

## التشغيل

```bash
npm start
```

افتح `http://127.0.0.1:4317`.

## الاستخدام الأول

1. افتح UI.
2. في `مزود LLM` اضبط `Base URL` و `API Key`، و `Default Model` اختياري.
3. اضغط `حفظ المزود`.
4. في لوحة agent أدخل settings path ثم اضغط `Start`.
5. أعد تشغيل agent.

يتم حفظ API key الحقيقي فقط في قاعدة البيانات المحلية:

```text
~/.agent-charles/agent-charles.db
```

عند الضغط على `Stop` يستعيد Agent Charles ملف الإعدادات من backup.
