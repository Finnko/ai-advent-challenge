# Feature: Agent

Корпоративный LLM-агент: инструменты по ролям, персистентность в SQLite, управление контекстом
стратегиями (`summary` / `none` / `window` / `facts` / `branch`), явная модель памяти
(краткосрочная = скользящее окно, рабочая, долговременная) и профиль пользователя (Day 12).

Всё собрано в **один рабочий экран** `/agent` с табами. Фича спроектирована так, чтобы её можно
было перенести в другой TanStack Start проект.

## Структура

```
src/features/agent/
  pages/       # AgentPage — единственная публичная поверхность (табы Диалог/Задача/Инварианты/Настройки)
  api/         # клиентские хуки react-query (bulletproof-стиль): queryOptions + useX/mutations
  functions/   # createServerFn-обёртки (сетевой шов)
  server/      # *.server.ts — глубокие server-only модули (agent-service, store)
  domain/      # изоморфная логика без env/fetch (agent, tools, контекст, факты, память, токены)
  data/        # клиентские данные без env (примеры, подписи инструментов)
  components/  # UI фичи
  tests/       # офлайн-тесты (vitest, node env)
  types.ts     # wire-типы ответов API
```

Слои: `pages` → `api` → `functions` (`createServerFn`) → `server`/`domain`. Роутов приложения два
уровня: `src/routes/_layout/agent.tsx` рендерит `pages/AgentPage`; `agent-strategies.tsx`,
`agent-memory.tsx`, `agent-profile.tsx` — `beforeLoad`-редиректы на `/agent` (старые закладки живы).

## Единый рабочий экран

- Табы `Диалог | Задача | Инварианты | Настройки`. `Задача`/`Инварианты` — disabled-заглушки
  (точки расширения под Day 13/14), `Настройки` — конфиг новой сессии, CRUD профилей и слои памяти.
- Поток: настроил конфиг во вкладке «Настройки» → создал сессию первым сообщением → работаешь в
  «Диалоге». Конфиг фиксируется за сессией; чтобы изменить — новая сессия.

## Конфиг сессии

`createSession` принимает `{ strategy, windowSize, memory, profileId }` (+ зарезервированные
`taskStateEnabled`, `invariantSetId`), хранит их в таблице `sessions` и дальше не меняет:

- `strategy` — одна из пяти стратегий контекста;
- `windowSize` — размер скользящего окна для стратегии `window` (default `WINDOW_SIZE = 10`,
  допустимо 2–50, валидатор `requireWindowSize`);
- `memory` — включает авто-извлечение и блоки памяти;
- `profileId` — профиль пользователя (явный id, `null` или дефолт токена).

Клиент шлёт только ids и выбранный конфиг. `runAgent` читает всё из сессии и прокидывает в
`executeAgent`; `windowSize` уходит в `ContextStrategy.prepare` через `PrepareInput.windowSize`.

## Модель памяти

Слои раздельны:

- **краткосрочная** — активная ветка `messages`, в промпт уходит как скользящее окно (стратегия
  `window`); размер окна — per-session.
- **рабочая** — `working_memory` (keyed by `session_id`), сбрасывается с сессией.
- **долговременная** — `long_term_memory` (keyed by `token`), переживает сессии.

`MemoryRouter` (`domain/memory/router.ts`) раскладывает кандидатов от `createExtractMemories` по
слоям. Слои вставляются отдельными `system`-блоками `long-term → working` после истории и перед
user-ходом. Дедуп — last-write-wins, ручная запись не перетирается авто, долговременная память
ограничена `LONG_TERM_LIMIT`.

## Профиль пользователя (Day 12)

Структурированный профиль (обращение, тон, язык, длина, формат, ограничения, свободные инструкции)
хранится в таблице `profiles` по `token` и фиксируется за сессией (`sessions.profile_id`).

- Шов — `domain/profile/`: `types.ts` (поля, лимиты, подписи) и `read.ts`
  (`formatProfileBlock` / `buildProfileBlocks`).
- `deleteProfile` обнуляет сессии и переносит дефолт; частичный уникальный индекс держит **один
  дефолт на token**.
- Блок вставляется system-сообщением после истории и перед памятью, порядок
  `profile → long-term → working`; строка приоритета идёт в последнее user-сообщение.
- Лимиты — в `functions/validation.ts` (`requireProfileName`, `optionalProfileField`: имя ≤60,
  поле ≤120, ограничения ≤500, инструкции ≤1200).

## Точки расширения (Day 13/14, ещё не реализовано)

- Зарезервированы поля сессии `task_state_enabled`, `invariant_set_id` (миграция идемпотентна).
- `SystemBlock.kind` расширится до `'invariants' | 'task-state'`: инварианты — в стабильные
  system-блоки после base system, состояние задачи — после истории, рядом с profile/memory.
- Day 13: домен `domain/task/`, стадия анализа состояния, таблица `task_states`, граф переходов
  `planning → execution → validation → done` (плюс paused/cancelled).
- Day 14: домен `domain/invariants/`, таблицы наборов/правил, pre-act guard + post-finalize judge,
  расширение `JudgeContext` и `AgentRunResult` списком нарушений.

## Внешние зависимости (общие, не входят в фичу)

При переносе нужно притащить и их (или заменить своими):

- `src/lib/llm.ts`, `src/lib/llm.server.ts` — транспорт DeepSeek / HF router, чтение env.
- `src/lib/functions/validation.ts` — базовые `requireToken` / `requireUser` / `requireSessionId`
  (агентские валидаторы лежат в `functions/validation.ts` фичи).
- `src/lib/utils.ts` (`cn`).
- `src/components/ui/Tabs.tsx` и остальной shadcn-совместимый UI-кит на Radix.
- `src/routes/__root.tsx` — `QueryClientProvider` (react-query).

npm-зависимости: `@tanstack/react-query`, `@tanstack/react-router`, `@tanstack/react-start`,
`gpt-tokenizer` (токены), `@radix-ui/react-tabs`, `@radix-ui/react-select`, `clsx`, `tailwind-merge`,
`react`, `react-dom`.

Env: `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `HUGGING_FACE_TOKEN`; путь БД — `AGENT_DB_PATH`
(по умолчанию `~/.ai-advent-challenge/agent.sqlite`).

## Как портировать

1. Скопировать `src/features/agent/` целиком.
2. Скопировать внешние зависимости из списка выше.
3. Завести роут `/agent`, рендерящий `pages/AgentPage` (и, при желании, редиректы со старых путей).
4. Прописать env и поднять `QueryClientProvider`.
5. Прогнать `npm run test` — тесты фичи офлайн (мокают LLM через `tests/agent-testkit.ts`).

Правила, за которые лучше не выходить: серверные ключи никогда не уходят в браузер; `node:sqlite`
импортируется только динамически внутри `.server.ts`; промпты/тексты лежат в `data/`/`domain/`,
а не в `functions/`.
