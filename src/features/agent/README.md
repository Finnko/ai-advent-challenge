# Feature: Agent

Корпоративный LLM-агент: инструменты по ролям, персистентность в SQLite, управление контекстом
стратегиями (`summary` / `none` / `window` / `facts` / `branch`), явная модель памяти
(краткосрочная = скользящее окно, рабочая, долговременная), профиль пользователя (Day 12) и
состояние задачи как конечный автомат (Day 13).

Всё собрано в **один рабочий экран** `/agent` с табами. Фича спроектирована так, чтобы её можно
было перенести в другой TanStack Start проект.

## Структура

```
src/features/agent/
  pages/       # AgentPage — единственная публичная поверхность (табы Диалог/Задача/Инварианты/Настройки)
  api/         # клиентские хуки react-query (bulletproof-стиль): queryOptions + useX/mutations
  functions/   # createServerFn-обёртки (сетевой шов)
  server/      # *.server.ts — глубокие server-only модули (agent-turn, agent-service, store)
  domain/      # изоморфная логика без env/fetch (agent, tools, контекст, память, профиль, задача, session, токены)
  data/        # клиентские данные без env (примеры, подписи инструментов)
  components/  # UI фичи
  tests/       # офлайн-тесты (vitest, node env)
  types.ts     # wire-типы ответов API
```

Слои: `pages` → `api` → `functions` (`createServerFn`) → `server`/`domain`. Роутов приложения два
уровня: `src/routes/_layout/agent.tsx` рендерит `pages/AgentPage`; `agent-strategies.tsx`,
`agent-memory.tsx`, `agent-profile.tsx` — `beforeLoad`-редиректы на `/agent` (старые закладки живы).

## Единый рабочий экран

- Табы `Диалог | Задача | Инварианты | Настройки`. `Задача` показывает состояние активной задачи и
  переходы, `Инварианты` — глобальный для token CRUD правил, `Настройки` — конфиг новой сессии, CRUD
  профилей и слои памяти.
- Поток: настроил черновик конфига во вкладке «Настройки» → нажал «Новая сессия» (сессия создаётся
  сразу с этим конфигом) или выбрал существующую → работаешь в «Диалоге». Пока сессия не выбрана,
  чата нет. Конфиг фиксируется за сессией; чтобы изменить — новая сессия.

## Выполнение Хода

`server/agent-turn.server.ts` — глубокий модуль Хода. `runAgentTurn({ token, sessionId, user }, deps)`
сам гидрирует способности, сессию, активную ветку, историю, сводку, факты, память и профиль,
запускает `executeAgent` и сохраняет обе реплики. `functions/run-agent.functions.ts` — тонкий
adapter: `validator → runAgentTurn`.

Шов `TurnDeps = { resolveCapabilities, store: TurnStore, runtime: AgentRuntime, now }`;
`defaultTurnDeps` — продакшн-проводка, офлайн-тесты (`tests/agent-turn.test.ts`) подставляют фейки.
`AgentRuntime` (`agent-service.server.ts`) держит транспорт и инструменты: `executeAgent(options,
runtime = defaultAgentRuntime)` не собирает их сам.

## Конфиг сессии

`domain/session/config.ts` — единственный дом Конфигурации сессии: типы `SessionConfig` /
`SessionConfigInput` / `SessionConfigDraft`, дефолты, разрешение профиля по умолчанию, превращение
драфта во вход и правило неизменности (`resolveActiveSessionConfig`). Wire-форма валидируется
`parseSessionConfigInput` (`functions/validation.ts`).

`createSession` принимает `Partial<SessionConfigInput>` (`strategy`, `scenario`, `windowSize`,
`memoryEnabled`, `profileId`, `taskStateEnabled`, + зарезервированный `invariantSetId`), хранит их в
таблице `sessions` и дальше не меняет. Правила defaulting живут в модуле, а store делегирует ему
разрешение конфигурации и выполняет server-side lookup default profile:

- `strategy` — одна из пяти стратегий контекста;
- `windowSize` — размер скользящего окна для стратегии `window` (default `DEFAULT_WINDOW_SIZE = 10`,
  допустимо 2–50, валидатор `requireWindowSize`);
- `memoryEnabled` — включает авто-извлечение и блоки памяти;
- `taskStateEnabled` — ведёт ли агент состояние задачи (default `true`, тумблер в «Настройках»);
- `profileId` — профиль пользователя: `undefined` (в draft это `null`) → дефолт токена, id → явный.
  Режим «без профиля» UI не предлагает.

Клиент шлёт только ids и выбранный конфиг (`api/send-message.ts`, `{ config: SessionConfigInput }`),
`AgentPage` держит один `SessionConfigDraft`. `runAgentTurn` читает конфиг из сессии и прокидывает в
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

## Состояние задачи (Day 13)

Задача ведётся как конечный автомат: **этап → текущий шаг → ожидаемое действие**. Граф
`planning → execution → validation → done` плюс `paused` (помнит `previousStage`) и `cancelled`.

- Шов — `domain/task/`: `types.ts` (стадии, актор, лимиты), `state.ts` (чистый reducer переходов,
  pause/resume/cancel, отклонение нелегальных переходов), `advance.ts` (авто-переходы после хода),
  `analyze.ts` (LLM-анализатор состояния), `read.ts` (system-блок и volatile-строка про
  этап/ожидаемое действие).
- Фича гейтится `sessions.task_state_enabled` (по умолчанию **включена**), фиксируется за сессией.
- Анализатор гоняется раз в Ход **до** `executeAgent`; при сбое состояние не меняется, usage → `auxUsage`.
- Snapshot живёт в таблице `task_states` (keyed by `session_id`, bounded `history_json`); пауза и
  продолжение переживают сессию. Кнопки и естественный язык («пауза», «продолжим») ведут к одному
  reducer'у.
- Блок `kind: 'task-state'` вставляется последним system-блоком в оба этапа (decide/finalize);
  при `paused` вызов инструментов жёстко блокируется.
- **`planning` = предложи и жди**: изменяющие инструменты (`isMutatingTool` в `agent-tools.ts`)
  скрыты из decide и жёстко отклоняются на act; справочные `list*` доступны. Мутации выполняются
  только на `execution`, куда задача уходит по явному согласию пользователя; на `validation` тоже
  только `list*`.
- **Авто-переходы** (`domain/task/advance.ts`): `execution → validation` после успешного мутирующего
  действия и `validation → done` **только после реальной справочной проверки** (`list*`) и без
  признаков правки; `done` также по явному подтверждению (анализатор). Если пользователь сообщает,
  что результат неверен (`looksLikeCorrection`), задача детерминированно возвращается
  `validation → execution` для переделки. Переходы пишут `task`-событие и переживают перезагрузку.
- **Кооперативная пауза**: `AgentConfig.isPaused` проверяется в начале каждой итерации цикла действий
  (после первого), поэтому пауза, поставленная во время хода, останавливает цикл между действиями;
  `runAgentTurn` даёт пробу по `task_states`.
- **Действия за Ход**: `decide → act` повторяется в пределах `maxActionsPerTurn` (default 5), пока
  модель выбирает следующий инструмент. Решения и отчёты возвращаются в decide, финализация собирает
  все `ОТЧЁТЫ` и требует все коды подтверждения. Цикл останавливается на `tool: null`, ошибке,
  повторе `tool+args` или лимите; судья `no-fabricated-actions` не даёт ответу приписать
  невыполненное действие.
- UI: переходы рисуются **inline в ленте чата** (`ChatThread` + `TaskEventRow`) как персистентные
  `task`-сообщения (`messages.role = 'task'`, событие в `run_json`). Их пишут и анализатор
  (`runAgentTurn`, между репликами user/assistant), и кнопки (`applyTaskAction`). `task`-сообщения
  не попадают в историю LLM. Текущие этап/шаг/ожидаемое действие и кнопки Пауза/Продолжить/Отменить —
  компактной строкой `TaskStateBar` над полем ввода; отдельного таба «Задача» нет.

## Инварианты (Day 14)

- Набор правил глобален для token; `sessions.invariant_set_id` остаётся зарезервированным.
- Правила хранятся в SQLite, пять pinned-правил создаются идемпотентно для каждого token. UI панели
  выполняет ручной CRUD, pinned-записи нельзя удалить.
- `SystemBlock.kind = 'invariants'` ставится сразу после base system. Проверки action выполняются до
  mutating tool, проверки ответа — после finalize; сработавшие `INV-*` попадают в `invariantHits` и UI.
- Pinned-правила нельзя удалить; их `slug` и `check` неизменяемы на сервере и в UI. Кастомные правила
  без `check` проверяются только prompt-ом, а при opt-in runtime — дополнительным `invariantGuard`.
- Новые инструменты: `cancelVacation`, `rejectVacation`, `rescheduleBooking`, `getRoomSchedule`,
  `updateBooking`, `declineInvite`.

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
