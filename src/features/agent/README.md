# Feature: Agent

Корпоративный LLM-агент: инструменты по ролям, персистентность в SQLite, управление контекстом
стратегиями (`summary` / `none` / `window` / `facts` / `branch`), явная модель памяти
(краткосрочная = скользящее окно, рабочая, долговременная), профиль пользователя (Day 12),
состояние задачи как конечный автомат (Day 13, ужесточено в Day 15), инварианты (Day 14)
и MCP-инструменты (Day 16–17).

Всё собрано в **один рабочий экран** `/agent` с табами. Фича спроектирована так, чтобы её можно
было перенести в другой TanStack Start проект.

## Структура

```
src/features/agent/
  pages/         # AgentPage — единственная публичная поверхность (табы Диалог/Инварианты/MCP/Настройки)
  api/           # клиентские хуки react-query (bulletproof-стиль): queryOptions + useX/mutations
  functions/     # createServerFn-обёртки (сетевой шов)
  server/        # *.server.ts — глубокие server-only модули (agent-turn, agent-service, task-state, mcp, mcp-tools)
  server/store/  # модули хранилища (db, sessions, tasks, invariants, profiles, agent-records)
  domain/        # изоморфная логика без env/fetch (agent, agent-tools, context, memory, profile, task, invariants, session, mcp, tokens)
  mcp/           # автономный stdio MCP-сервер (спавнится, не импортируется/не бандлится): server, tools, db
  data/          # клиентские данные без env (примеры, подписи инструментов)
  components/    # UI фичи
  tests/         # офлайн-тесты (vitest, node env)
  types.ts       # wire-типы ответов API
```

Слои: `pages` → `api` → `functions` (`createServerFn`) → `server`/`domain`. Роутов приложения два
уровня: `src/routes/_layout/agent.tsx` рендерит `pages/AgentPage`; `agent-strategies.tsx`,
`agent-memory.tsx`, `agent-profile.tsx` — `beforeLoad`-редиректы на `/agent` (старые закладки живы).

## Единый рабочий экран

- Табы `Диалог | Инварианты | MCP | Настройки`. `Инварианты` — глобальный для token CRUD правил,
  `MCP` — список инструментов MCP-сервера, `Настройки` — конфиг новой сессии, CRUD профилей и слои
  памяти. Состояние активной задачи — не отдельный таб, а компактная строка `TaskStateBar` над полем
  ввода в «Диалоге».
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
runtime = defaultAgentRuntime)` не собирает их сам. Сбой API (например, сырой 400 на слишком большой
промпт) превращается в заблокированный `AgentRunResult`, а не в брошенное исключение.

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

## Контекстные стратегии

- Шов — `domain/context/`: `ContextStrategyId = 'summary' | 'none' | 'window' | 'facts' | 'branch'`,
  `ContextStrategy.prepare(input)` → `PreparedContext { history, blocks, note }`.
- Стратегия фиксируется за сессией (`sessions.strategy`), её ставит `createSession` и читает
  `runAgentTurn`; на середине сессии она не переключается.
- Блоки стратегии вставляются отдельными `system`-сообщениями после базового system и перед голой
  историей — и в `decide`, и в `finalize`. Базовый system байт-в-байт одинаков между этапами, а
  волатильное (инструменты, комнаты, context, инструкция этапа) уходит в последнее user-сообщение —
  так префикс кеша выживает.
- Чистые модули без env/fetch (офлайн-тесты): `domain/compression.ts` (`splitHistory`,
  `toLlmMessages`) и стратегии `domain/context/`.

## Модель памяти

Слои раздельны:

- **краткосрочная** — активная ветка `messages`, в промпт уходит как скользящее окно (стратегия
  `window`); размер окна — per-session.
- **рабочая** — `working_memory` (keyed by `session_id`), сбрасывается с сессией.
- **долговременная** — `long_term_memory` (keyed by `token`), переживает сессии.

Шов — `domain/memory/`: `types.ts` (слои/записи), `extract.ts` (LLM-кандидаты с меткой слоя),
`router.ts` (`MemoryRouter` валидирует и раскладывает по слоям), `read.ts` (слияние, лимит
долговременной, сборка system-блоков). Слои вставляются отдельными `system`-блоками
`long-term → working` после истории и перед user-ходом; `SystemBlock.kind` покрывает
`'working' | 'long-term'`. Дедуп — last-write-wins, ручная запись (`source='manual'`) не перетирается
авто, долговременная память ограничена `LONG_TERM_LIMIT`. Строка приоритета
(`MEMORY_PRECEDENCE_LINE`) добавляется в последнее user-сообщение: память авторитетнее ранней истории.

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

## Инструменты

- Реестр — `domain/agent-tools.ts`. `TOOLS_BY_ROLE` выводится из поля `roles` каждого инструмента,
  поэтому способности, decide-промпт и `isPermitted` не расходятся.
- **Действия за Ход**: `decide → act` повторяется в пределах `maxActionsPerTurn` (default 5), пока
  модель выбирает следующий инструмент, затем один `finalize` по всем отчётам. Цикл останавливается
  на `tool: null`, ошибке инструмента, повторе `tool+args` или лимите; судья `no-fabricated-actions`
  блокирует ответ, приписывающий невыполненное действие.
- `executeAgent` собирает короткий `context` (последняя управляемая бронь / ожидающая заявка на
  отпуск) и кладёт его в `AgentConfig.context`; если на action-подобный запрос `decide` вернул
  `tool: null`, следует один повтор с подсказкой.
- Комнаты резолвятся без учёта регистра и префикса; группы сверх `ROOM_CAPACITY` отклоняются;
  `listVacations` не показывает референсные коды.
- Инструменты получают `ToolClock` (`createAgentTools(store, now)`): `bookMeetingRoom` отказывает на
  слот в прошлом, `listBookings` по умолчанию скрывает прошедшие встречи (переопределяется
  `includePast`/`from`/`to`).
- Реестр ролей включает отмену/отклонение отпуска, перенос/обновление брони, расписание комнат и
  отклонение приглашения. `screenArgs` может нормализовать адресата до детерминированных проверок
  инвариантов; источником истины при исполнении остаётся сам инструмент.

## Состояние задачи (Day 13, ужесточено в Day 15)

Задача ведётся как конечный автомат: **этап → текущий шаг → ожидаемое действие**. Граф
`planning → execution → validation → done` плюс `paused` (помнит `previousStage`) и `cancelled`.

- Шов — `domain/task/`: `types.ts` (стадии, актор, лимиты), `state.ts` (чистый reducer переходов,
  единственная точка `transitionTask` поверх `ALLOWED_TRANSITIONS`, pause/resume/cancel, отклонение
  нелегальных переходов), `advance.ts` (авто-переходы после хода, текстовые гейты), `analyze.ts`
  (LLM-анализатор состояния), `read.ts` (system-блок и volatile-строка про этап/ожидаемое действие).
- Фича гейтится `sessions.task_state_enabled` (по умолчанию **включена**), фиксируется за сессией.
- Анализатор гоняется раз в Ход **до** `executeAgent`; при сбое состояние не меняется, usage → `auxUsage`.
- Snapshot живёт в таблице `task_states` (keyed by `session_id`, bounded `history_json`); пауза и
  продолжение переживают сессию. Кнопки и естественный язык («пауза», «продолжим») ведут к одному
  reducer'у.
- Блок `kind: 'task-state'` вставляется последним system-блоком в оба этапа (decide/finalize);
  при `paused` вызов инструментов жёстко блокируется.
- **`planning` = предложи и жди**: изменяющие инструменты (`isMutatingTool` в `agent-tools.ts`)
  скрыты из decide и жёстко отклоняются на act; справочные `list*` доступны. Мутации выполняются
  только на `execution` при выставленном `TaskState.approved`; на `validation` тоже только `list*`.
  Чисто справочные задачи идут по этапам без согласия.
- **Контроль переходов (Day 15)**: любой переход валидируется в `transitionTask` по графу
  `ALLOWED_TRANSITIONS`; нелегальный возвращает `rejected` и не меняет состояние. `planning → execution`
  невозможен при незакрытых пунктах плана (`expectedAction.actor === 'user'`): `runAgentTurn` оставляет
  задачу в `planning`, пишет `task`-событие `kind: 'rejected'` и подмешивает строку-подсказку в
  `taskLine` (decide + finalize), чтобы ассистент озвучил отказ. Согласие пользователя больше не
  запирает сам переход: `runAgentTurn` распознаёт его через `looksLikeApproval` (в `advance.ts`,
  устойчиво к опечаткам в одну правку) и выставляет `TaskState.approved`. Изменяющие инструменты
  требуют этого флага, поэтому мутация без согласия отклоняется даже на этапе `execution`. Флаг
  хранится в `task_states.approved` и сбрасывается при возврате в `planning`.
- **Авто-переходы** (`domain/task/advance.ts`): `execution → validation` после успешного мутирующего
  действия и `validation → done` **только после реальной справочной проверки** (`list*`) и без
  признаков правки; `done` также по явному подтверждению (анализатор). Если пользователь сообщает,
  что результат неверен (`looksLikeCorrection`), задача детерминированно возвращается
  `validation → execution` для переделки. Переходы пишут `task`-событие и переживают перезагрузку.
- **Кооперативная пауза**: `AgentConfig.isPaused` проверяется в начале каждой итерации цикла действий
  (после первого), поэтому пауза, поставленная во время хода, останавливает цикл между действиями;
  `runAgentTurn` даёт пробу по `task_states`.
- UI: переходы рисуются **inline в ленте чата** (`ChatThread` + `TaskEventRow`) как персистентные
  `task`-сообщения (`messages.role = 'task'`, событие в `run_json`). Их пишут и анализатор
  (`runAgentTurn`, между репликами user/assistant), и кнопки (`applyTaskAction`). `task`-сообщения
  не попадают в историю LLM. Текущие этап/шаг/ожидаемое действие и кнопки Пауза/Продолжить/Отменить —
  компактной строкой `TaskStateBar` над полем ввода.

## Инварианты (Day 14)

- Набор правил глобален для token; `sessions.invariant_set_id` остаётся зарезервированным.
- Правила хранятся в SQLite, пять pinned-правил создаются идемпотентно для каждого token. UI панели
  выполняет ручной CRUD, pinned-записи нельзя удалить.
- `SystemBlock.kind = 'invariants'` ставится сразу после base system. Проверки action выполняются до
  mutating tool, проверки ответа — после finalize; сработавшие `INV-*` попадают в `invariantHits` и UI.
- Pinned-правила нельзя удалить; их `slug` и `check` неизменяемы на сервере и в UI. Кастомные правила
  без `check` проверяются только prompt-ом, а при opt-in runtime — дополнительным `invariantGuard`
  (падает открыто при ошибке guard, детерминированную проверку не заменяет).
- Новые инструменты: `cancelVacation`, `rejectVacation`, `rescheduleBooking`, `getRoomSchedule`,
  `updateBooking`, `declineInvite`.

## MCP (Day 16–17)

- `mcp/server.ts` — stdio-сервер (`McpServer` + `StdioServerTransport`), регистрирует инструменты в
  `mcp/tools.ts` (`registerTool` + zod-схемы). Это **спавн-процесс**, приложение его не импортирует:
  `node` исполняет `.ts` напрямую (Node ≥22 type stripping), поэтому в `vite build` его нет.
- `server/mcp.server.ts` — глубокий клиент: `withClient` открывает `StdioClientTransport` на вызов,
  закрывает после. Публичный шов `listMcpTools()` и `callTool(name, args)` возвращают
  `{ ok } | { ok: false; error }`, никогда не бросают. `AGENT_DB_PATH` форвардится в дочерний процесс
  явно (SDK наследует только безопасный набор env).
- **DB-инструменты (Day 17)**: `mcp/db.ts` открывает `agent.sqlite` **read-only** (`DatabaseSync` с
  `readOnly: true`, без миграций/бэкапов) и отдаёт `db_overview`, `bookings_by_room`,
  `employee_schedule`. Префикс `mcp_` добавляется только на слое адаптера агента
  (`domain/mcp/agent-tools.ts`), поэтому на проводе имена чистые.
- **Интеграция с агентом (Day 17)**: `domain/mcp/args-example.ts` строит `argsExample` из JSON-схемы;
  `domain/mcp/agent-tools.ts` превращает descriptors в `AgentTool` (обе роли, `run` делегирует в
  `callTool`); `server/mcp-tools.server.ts` собирает `loadMcpTools()`. `AgentRuntime.loadMcpTools?`
  вызывается внутри `executeAgent`: инструменты добавляются к `createTools(...)`, их имена — в
  `capabilities.allowedTools` (видны `decide`, `isPermitted`, судье `business-rules`). Read-only →
  доступны и на `planning`/`validation`. Сбой обнаружения деградирует к отсутствию MCP-инструментов;
  write-бэкенд остаётся in-process.
- UI: `components/McpPanel.tsx` + `McpToolCard.tsx` во вкладке «MCP». Тесты: `tests/mcp.test.ts`
  (спавнит сервер, список + `now` + DB-инструменты на временной БД) и `tests/mcp-agent.test.ts`
  (адаптер + `executeAgent`, вызывающий MCP-инструмент).
- Dev/test only: вход резолвится по исходному пути, поэтому присутствия в `vite build` нет. Day 18
  (scheduling + sqlite persistence) решит свою модель процесса и переезд записи в MCP.

## Персистентность

- `server/store.server.ts` — singleton `node:sqlite`. `node:sqlite` импортируется только динамически
  (`await import`) внутри `.server.ts`, чтобы не попасть в клиентский бандл.
- Путь БД — `~/.ai-advent-challenge/agent.sqlite` (override `AGENT_DB_PATH`); легаси
  `data/agent.sqlite` мигрирует на первом открытии, а существующая БД снимается в `<db>.backups/`
  (последние `BACKUP_LIMIT = 5`).
- Миграции идемпотентны (`PRAGMA table_info` + `ALTER`). Ветки copy-on-fork; `loadMessages` и
  `appendMessage` работают в рамках активной ветки.
- Таблицы: `sessions` (`strategy`/`scenario`/`memory_enabled`/`profile_id`/`window_size`/
  `task_state_enabled` + зарезервированный `invariant_set_id`), `task_states`, `invariants`,
  `working_memory`, `long_term_memory`, `profiles`, `session_facts`, `session_summaries`.

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
`react`, `react-dom`, а для MCP — `@modelcontextprotocol/sdk` и `zod`.

Env: `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `HUGGING_FACE_TOKEN`; путь БД — `AGENT_DB_PATH`
(по умолчанию `~/.ai-advent-challenge/agent.sqlite`).

## Как портировать

1. Скопировать `src/features/agent/` целиком.
2. Скопировать внешние зависимости из списка выше.
3. Завести роут `/agent`, рендерящий `pages/AgentPage` (и, при желании, редиректы со старых путей).
4. Прописать env и поднять `QueryClientProvider`.
5. Для MCP: Node ≥22 (сервер исполняет `.ts` через type stripping) и форвард `AGENT_DB_PATH` в
   дочерний процесс.
6. Прогнать `npm run test` — тесты фичи офлайн (мокают LLM через `tests/agent-testkit.ts`).

Правила, за которые лучше не выходить: серверные ключи никогда не уходят в браузер; `node:sqlite`
импортируется только динамически внутри `.server.ts`; MCP SDK не доходит ни до LLM-транспорта, ни до
браузера; промпты/тексты лежат в `data/`/`domain/`, а не в `functions/`.
