# AI Advent Challenge

Ежедневные шаги по изучению AI. Каждый день — отдельная ветка `feature/dayN`.

## Day 1 — минимальный вызов LLM

Минимальное приложение, которое отправляет запрос в [DeepSeek](https://api-docs.deepseek.com/) через
OpenAI-совместимый `chat/completions` endpoint, получает ответ и показывает его в браузере.

**Стек:** TanStack Start (Vite + React 19 + TypeScript), Tailwind v4, голый `fetch` — никаких SDK на LLM-слое.

### Запуск

```bash
npm install
cp .env.example .env   # впиши DEEPSEEK_API_KEY
npm run dev            # http://localhost:3000
```

### Env

| Переменная           | Обязательна | Описание                                   |
| -------------------- | ----------- | ------------------------------------------ |
| `DEEPSEEK_API_KEY`   | да          | Ключ API DeepSeek                          |
| `DEEPSEEK_MODEL`     | нет         | Модель (по умолчанию `deepseek-v4-flash`)  |

`.env` в gitignore — ключ никогда не коммитится.

### Как это устроено

- `src/lib/chat.ts` — `createServerFn` (`POST`): читает ключ и модель из `process.env`,
  делает `fetch('https://api.deepseek.com/chat/completions')` и возвращает `choices[0].message.content`.
  Ключ выполняется на сервере и **не попадает в браузер**.
- `src/routes/index.tsx` — UI: textarea + кнопка, анимация «3 точки» во время ожидания, ответ одним куском.

### Структура

```
src/
├── lib/chat.ts        # серверная функция: вызов DeepSeek
└── routes/
    ├── __root.tsx     # корневой layout (Head, Header, Footer, devtools)
    ├── index.tsx      # страница чата
    └── about.tsx      # служебная страница стартера
```

### Про деплой

Для разработки отдельный сервер не нужен — всё локально в одном процессе (`npm run dev`).
Прод (`npm run build`) — это SSR-приложение на Node, ему нужен Node-рантайм (VPS или серверлесс-платформа).
На Day 1 деплой вне scope.

### Вне scope (следующие шаги)

- Потоковая выдача ответа (streaming / SSE)
- История сообщений
- Сохранение и деплой
