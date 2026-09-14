# Feature: Agent

Корпоративный LLM-агент: инструменты по ролям, персистентность в SQLite, управление контекстом
стратегиями (`summary` / `none` / `window` / `facts` / `branch`), явная модель памяти
(`short-term` / `working` / `long-term`) и UI на трёх роутах.

Фича спроектирована так, чтобы её можно было перенести в другой TanStack Start проект.

## Структура

```
src/features/agent/
  pages/       # AgentPage (Day 9), AgentStrategiesPage (Day 10), AgentMemoryPage (Day 11) — единственная публичная поверхность
  api/         # клиентские хуки react-query (bulletproof-стиль): queryOptions + useX/mutations
  functions/   # createServerFn-обёртки (сетевой шов)
  server/      # *.server.ts — глубокие server-only модули (agent-service, store)
  domain/      # изоморфная логика без env/fetch (agent, tools, контекст, факты, память, токены)
  data/        # клиентские данные без env (примеры, мок сценария)
  components/  # UI фичи
  tests/       # офлайн-тесты (vitest, node env)
  types.ts     # wire-типы ответов API
```

Слои: `pages` → `api` → `functions` (`createServerFn`) → `server`/`domain`. Роуты приложения —
тонкие обёртки: `src/routes/_layout/agent.tsx`, `src/routes/_layout/agent-strategies.tsx`,
`src/routes/_layout/agent-memory.tsx`.

## Модель памяти (Day 11)

Три слоя, каждый — отдельное хранилище:

- **short-term** — текущий диалог, таблица `messages` (branch-scoped); в промпт уходит как история
  (стратегия `window`).
- **working** — данные текущей задачи, таблица `working_memory` (keyed by `session_id`); сбрасывается
  вместе с сессией.
- **long-term** — профиль, решения, знания, таблица `long_term_memory` (keyed by `token`); переживает
  сессии и сценарии.

`MemoryRouter` (`domain/memory/router.ts`) явно раскладывает кандидатов от `createExtractMemories` по
слоям (валидация ключа/значения, fallback по категории). Слои вставляются отдельными `system`-блоками
`long-term → working` после базового system и перед историей. Дедуп — last-write-wins, ручная запись
не перетирается авто, долговременная память ограничена 50 записями.

## Внешние зависимости (общие, не входят в фичу)

При переносе нужно притащить и их (или заменить своими):

- `src/lib/llm.ts`, `src/lib/llm.server.ts` — транспорт DeepSeek / HF router, чтение env.
- `src/lib/functions/validation.ts` — базовые `requireToken` / `requireUser` / `requireSessionId`
  (агентские валидаторы лежат в `functions/validation.ts` фичи).
- `src/lib/utils.ts` (`cn`).
- `src/components/ui/Tabs.tsx` — shadcn-совместимые табы на `@radix-ui/react-tabs`.
- `src/routes/__root.tsx` — `QueryClientProvider` (react-query).

npm-зависимости: `@tanstack/react-query`, `@tanstack/react-router`, `@tanstack/react-start`,
`gpt-tokenizer` (токены), `@radix-ui/react-tabs`, `clsx`, `tailwind-merge`, `react`, `react-dom`.

Env: `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `HUGGING_FACE_TOKEN`; путь БД — `AGENT_DB_PATH`
(по умолчанию `~/.ai-advent-challenge/agent.sqlite`).

## Как портировать

1. Скопировать `src/features/agent/` целиком.
2. Скопировать внешние зависимости из списка выше.
3. Завести роуты, которые рендерят `pages/AgentPage`, `pages/AgentStrategiesPage` и `pages/AgentMemoryPage`.
4. Прописать env и поднять `QueryClientProvider`.
5. Прогнать `npm run test` — тесты фичи офлайн (мокают LLM через `tests/agent-testkit.ts`).

Правила, за которые лучше не выходить: серверные ключи никогда не уходят в браузер; `node:sqlite`
импортируется только динамически внутри `.server.ts`; промпты/тексты лежат в `data/`/`domain/`,
а не в `functions/`.
