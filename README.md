# AI Advent Challenge

Ежедневные шаги по изучению AI. Каждый день — отдельная ветка `feature/dayN`, после проверки
вмерживается в `main`. Каждый день — своя страница-демо в общем каркасе приложения.

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
| `HUGGING_FACE_TOKEN` | для Day 5   | Ключ Hugging Face (weak-модель через роутер) |

`.env` в gitignore — ключ никогда не коммитится.

## Day 1 — минимальный вызов LLM

Страница `/day1`: отправить запрос в [DeepSeek](https://api-docs.deepseek.com/) через
OpenAI-совместимый `chat/completions`, получить обычный текстовый ответ. Ключ и модель читаются
из `process.env` **на сервере** и не попадают в браузер.

## Day 2 — формат ответа

Страница `/day2`: один и тот же промпт в двух вкладках — свободная форма и «жёсткий» JSON-контракт
(system-промпт + `max_tokens` + `stop` + `response_format: json_object`), с инспектором «What was sent».

## Day 3 — стратегии промпта

Страница `/day3`: **одно задание решается четырьмя способами**, результаты сравниваются:

1. **Direct** — запрос без дополнительных инструкций;
2. **Step-by-step** — инструкция «решай пошагово»;
3. **Prompt-crafted** — модель сначала сама пишет промпт, затем решает им;
4. **Expert panel** — аналитик, инженер и критик отвечают независимо.

Два встроенных задания с эталонными ответами (Monty Hall и «кувшины 5л/3л → 4л»). Когда все четыре
стратегии ответили, отдельный вызов-судья сравнивает ответы с эталоном и выдаёт JSON-вердикт: оценки
по стратегиям и «какой способ точнее». Эталон всегда виден рядом.

### Как это устроено (Day 3)

- `src/lib/chat.ts` — единственный LLM-слой: приватный `callCompletions(endpoint, apiKey, …)` и server fn `ask`
  server fn: `chat` (day1/day2) и generic `ask({ system, user, params? })` для композиции шагов.
- `src/lib/day3.ts` — client-safe данные: задания с эталонами, системные промпты всех стратегий,
  текст судьи; никаких env/секретов.
- `src/routes/_layout/day3.tsx` — клиентская оркестрация: стратегии собираются из гранулярных
  `ask()`-вызовов прямо на странице (потом шаги можно свободно перекомбинировать).

## Day 4 — температура

Страница `/day4`: **один и тот же запрос** отправляется трижды — с `temperature` 0, 0.7 и 1.2 —
параллельно, три карточки в ряд. Задание просит сравнить ответы по точности, креативности и
разнообразию и понять, какая настройка для каких задач подходит.

- Встроенная логическая задача «День рождения Шерил» с эталоном + свободное поле «Свой промпт» —
  свой запрос без эталона и без автопроверки.
- System-промпт просит рассуждать по шагам и заканчивать строкой `Итог: <ответ>` — по ней
  детерминированная эвристика на клиенте помечает карточку «Итог верный / не совпал» (без LLM-судьи).
  Для своего промпта пометка и эталон скрыты.
- В правом сайдбаре — инспектор запроса: `model` (из ответа сервера), `system`, `user`,
  `thinking: disabled` и `temperature` активной карточки.
- Внизу: эталонный ответ и статичные выводы «какая температура для каких задач».

### Как это устроено (Day 4)

- `src/lib/chat.ts` — параметры `ask` расширены полем `temperature` (валидируется 0–2, шлётся только
  если задан), а `ChatResult` теперь возвращает `model` (имя из `DEEPSEEK_MODEL`). Day 1–3 не менялись.
- `src/lib/day4.ts` — client-safe данные: задача с эталоном и допустимыми формулировками,
  значения температур, выводы, эвристика `checkFinalAnswer`.
- `src/routes/_layout/day4.tsx` — оркестрация: три параллельных `ask()` с разной `temperature`;
  два источника запроса (готовая задача или свой промпт), каждый новый запуск сбрасывает результаты.

## Day 5 — версии моделей

Страница `/day5`: **один и тот же запрос — продуктовое ТЗ интернет-магазина — уходит в три модели
разного уровня**: слабую (`Qwen/Qwen3-8B` через Hugging Face-роутер), среднюю (`deepseek-v4-flash`)
и сильную (`deepseek-v4-pro`). Каждая модель сама предлагает техническую архитектуру. Кнопка
блокируется, пока все три не ответят; на карточках — время ответа (замер на сервере), токены и текст.
Успешные ответы автосохраняются в `md/design/proposals/`.

- Бриф — **локальный, gitignored** `md/design/brief.md` (продуктовое ТЗ без тех-подсказок); читается
  серверной функцией `readBrief` из `process.cwd()`.
- `src/lib/chat.ts` — приватный обобщённый вызов `callCompletions` (OpenAI-совместимые DeepSeek и HF-роутер,
  `thinking: disabled` только для DeepSeek), `ChatResult` возвращает `model` и серверный `latencyMs`; новые
  server fns: `askModel({ tier })` (клиент шлёт только `weak|medium|strong`, маппинг `TIER_ENDPOINTS` на сервере),
  `readBrief`, `saveProposal`.
- `src/lib/day5.ts` — client-safe данные: метаданные ступеней, system-промпт, ссылки на модели.
- `src/routes/_layout/day5.tsx` — кнопка «Собрать 3 предложения», три карточки с ответами и метриками,
  блок «что отправлено», выводы и ссылки.

## Day 6 — первый агент

Агент как **отдельная сущность**, а не один вызов API. Пользователь пишет запрос свободным
текстом; агент проходит стадии `input policy → decide (JSON-роутинг инструмента) → act →
finalize → судьи`. В Day 6 демо живёт без памяти на `/day6`; в Day 7 тот же агент переезжает
на единую страницу `/agent` и получает память (см. ниже).

- Права роли задаются **мок-токеном** и резолвятся серверной `resolveCapabilities` — агент
  берёт права из токена, а не из слов пользователя («согласуй мне отпуск» отклоняется).
- Инструменты: `bookMeetingRoom`, `requestVacation`, `approveVacation` (только руководитель).
- Судьи: `output-policy` (непустой ответ + код подтверждения инструмента) и `business-rules`
  (нельзя согласовать себе; инструмент вне прав роли отклоняется).
- Модель `deepseek-v4-flash`, `thinking: disabled`; decide 0.2, finalize 0.7.
- В UI — трасса стадий под каждым ответом; каждый запуск — новый экземпляр агента.

### Как это устроено (Day 6)

- `src/lib/agent.ts` — портативная библиотека: класс `Agent` + типы `Capabilities`/`Tool`/`Judge`,
  стадии `run()`, инструменты и судьи. **Не знает про env и `fetch`** — LLM-транспорт инжектится
  (`callLLM`), поэтому та же «коробка» потом сможет работать и в конфиге opencode.
- `src/lib/chat.ts` — server fns: `resolveCapabilities({ token })` и `runAgent(...)` на адаптере flash.

## Day 7 — сохранение контекста

Тот же агент на роуте `/agent` (бывший `/day6`), но теперь с памятью: история и бизнес-факты
переживают перезапуск приложения. Проверка — начать диалог, перезапустить, продолжить.

- **Хранилище** — SQLite через встроенный `node:sqlite` (`src/lib/store.ts`, файл
  `data/agent.sqlite`, gitignored): таблицы `people`, `sessions`, `messages`, `vacations`,
  `bookings`. Никаких новых зависимостей.
- **Два слоя памяти.** История диалога: assistant-сообщения хранят и голый текст (реплей в
  `decide`/`finalize` — ролям `LlmMessage` добавлен `assistant`), и полный `AgentRunResult`
  (`run_json` для трассы в UI после рестарта). Бизнес-состояние: инструменты пишут эффекты в БД —
  бронирования в `bookings`, отпуска в `vacations`.
- **Оргструктура из данных.** Люди — не константа, а таблица `people`, засеянная моком:
  руководитель Анна + линейные Пётр, Мария, Иван (`manager_token`). `resolveCapabilities`
  читает человека и его подчинённых; список грузится server fn `listOrg`. Замена на реальный
  бэкенд = подмена источника за этим швом.
- **Несколько сессий на персону.** `sessions` + `messages.session_id`; серверные
  `listSessions`/`loadSession`/`deleteSession`. В UI слева — список сессий текущей персоны
  (заголовок из первого сообщения, создание/удаление), справа — чат.
- **Правило подчинённых.** `approveVacation` согласует только прямых подчинённых (самому себе
  и «не своим» — отказ: проверяется и инструментом, и судьёй `business-rules`). Новый инструмент
  `listVacations` (менеджер) отвечает «кому я согласовал отпуск» из записей БД, а не по памяти модели.
- `runAgent({ token, sessionId, user })`: грузит историю сессии, прогоняет агента, сохраняет
  сообщения; при пустом `sessionId` сессия создаётся автоматически.
- Вкладки сайдбара переименованы в смысловые (`Base LLM API`, `Prompt format`,
  `Prompt strategies`, `Temperature`, `Model tiers`, `Agent`); роут `/agent` шире, глобальный
  сайдбар уже. Нумерация дней остаётся только в этом README.

### Как это устроено (Day 7)

- `src/lib/agent.ts` — `LlmMessage` теперь с `assistant`, `AgentIdentity.subordinates`,
  `Agent.run(user, history?)` (история реплеится в decide/finalize), `createAgentTools(store)`
  (инструменты персистят через инжектированный `AgentStore`) и `listVacations`.
- `src/lib/store.ts` — ленивый `node:sqlite`-синглтон: схема, сид `people`, CRUD сессий/сообщений,
  фабрика `createAgentStore()` под интерфейс `AgentStore`.
- `src/lib/chat.ts` — `resolveCapabilities`/`listOrg` читают `people`; сессии через
  `listSessions`/`loadSession`/`deleteSession`; `runAgent({ token, sessionId, user })`
  (автосоздание сессии + реплей истории + сохранение сообщений).
- `src/lib/day6.ts` — client-safe данные UI агента: `TOOL_INFO`, примеры запросов.
- `src/components/agent/` — `PersonaPicker` (орг-чарт: руководитель слева, сотрудники справа),
  `SessionList`, `ChatThread`, `TraceAccordion` и др.
- `src/routes/_layout/agent.tsx` — орг-чарт из `listOrg`, панель сессий слева, чат с трассой справа.

### Структура

```
src/
├── lib/chat.ts          # LLM-слой: callCompletions + server fn chat/ask/askModel/readBrief/saveProposal/resolveCapabilities/listOrg/listSessions/loadSession/deleteSession/runAgent
├── lib/agent.ts         # портативный агент: Agent, LlmMessage(+assistant), createAgentTools(store), судьи (без env/fetch)
├── lib/store.ts         # SQLite (node:sqlite): people/sessions/messages/vacations/bookings + createAgentStore
├── lib/days.ts          # навигация: смысловые лейблы для сайдбара и хаба
├── lib/day3.ts          # задания, промпты и судья для Day 3
├── lib/day4.ts          # задания, температуры и выводы для Day 4
├── lib/day5.ts          # ступени моделей, system и ссылки для Day 5
├── lib/day6.ts          # данные UI агента: TOOL_INFO, примеры запросов
├── components/          # Header, ThemeToggle, Sidebar, agent/ (PersonaPicker, SessionList, ChatThread, …)
└── routes/
    ├── __root.tsx       # корневой layout
    └── _layout/         # сайдбар + страницы
        ├── index.tsx    # хаб с карточками
        ├── day1.tsx     # свободный чат
        ├── day2.tsx     # сравнение free vs constrained
        ├── day3.tsx     # 4 стратегии промпта + вердикт
        ├── day4.tsx     # один запрос при temperature 0 / 0.7 / 1.2
        ├── day5.tsx     # один бриф на трёх моделях + предложения архитектуры
        └── agent.tsx    # агент с памятью: орг-чарт, сессии, чат + трасса стадий
```

### Про деплой

Для разработки отдельный сервер не нужен — всё локально в одном процессе (`npm run dev`),
данные — в `data/agent.sqlite` (gitignored). Прод (`npm run build`) — это SSR-приложение на Node;
деплой вне scope.

### Вне scope (следующие шаги)

- Потоковая выдача ответа (streaming / SSE)
- Настоящий бэкенд для `people`/токенов (сейчас — мок-сид в SQLite за швом `resolveCapabilities`)
- Многопоточность сессий и деплой
