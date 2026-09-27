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
  api/           # клиентские хуки react-query (bulletproof-стиль): queryOptions + useX/mutations;
                 # workspace-хуки по заботам — use-session/settings/task-workspace + композиция
  functions/     # createServerFn-обёртки (сетевой шов)
  server/        # *.server.ts — глубокие server-only модули (agent-turn, agent-service, task-turn, task-state, mcp, mcp-tools)
  server/store/  # модули хранилища по концептам (db, sessions, branches, messages, facts, memory, people, tasks, invariants, profiles, agent-records)
  shared/        # нейтральные node-утилиты для server и mcp (разрешение пути sqlite)
  domain/        # изоморфная логика без env/fetch (agent, agent-tools, context, memory, profile, task, invariants, session, mcp, jobs, tokens)
  mcp/           # автономный stdio MCP-сервер (спавнится, не импортируется/не бандлится): server, tools, db, shared
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
запускает `executeAgent` и сохраняет обе реплики. Оркестрация Задачи вокруг Хода вынесена в
`server/task-turn.server.ts` (`beginTaskTurn` — отмена/пауза-возобновление, `resolveTaskState` —
анализ, `resolveCorrection`, `completeTaskTurn` — авто-переходы и сохранение), поэтому
`runAgentTurn` читается как «load → execute → persist». `functions/run-agent.functions.ts` — тонкий
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
- **Действия за Ход**: `decide → act` повторяется в пределах `maxActionsPerTurn` (default 10), пока
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
- **`planning` = предложи и жди**: изменяющие инструменты (флаг `AgentTool.mutating`; у внутренних
  он из `ToolDefinition.mutating`, у MCP — из аннотации сервера)
  скрыты из decide и жёстко отклоняются на act; справочные `list*` доступны. Мутации выполняются
  только на `execution` при выставленном `TaskState.approved`; на `validation` тоже только `list*`.
  Чисто справочные задачи идут по этапам без согласия.
- **Контроль переходов (Day 15)**: любой переход валидируется в `transitionTask` по графу
  `ALLOWED_TRANSITIONS`; нелегальный возвращает `rejected` и не меняет состояние. `planning → execution`
  невозможен при незакрытых пунктах плана (`expectedAction.actor === 'user'`), **если пользователь не
  дал явного согласия**: тогда `runAgentTurn` оставляет задачу в `planning`, пишет `task`-событие
  `kind: 'rejected'` и подмешивает строку-подсказку в `taskLine` (decide + finalize), чтобы ассистент
  озвучил отказ. Согласие пользователя больше не запирает сам переход: `runAgentTurn` распознаёт его
  через `looksLikeApproval` (в `advance.ts`, устойчиво к опечаткам в одну правку) и выставляет
  `TaskState.approved`. Изменяющие инструменты требуют этого флага, поэтому мутация без согласия
  отклоняется даже на этапе `execution`. Флаг хранится в `task_states.approved` и сбрасывается при
  возврате в `planning`.
- **Один аппрув на весь план (fix)**: явное одобрение (`looksLikeApproval`) авторитетно — оно
  восстанавливает `approved` и переводит в `execution` даже при незакрытых пунктах, а также
  нормализует `expectedAction` на `actor='agent'` (в `resolveTaskState` и `approveTask`). Пока
  `execution` + `approved`, `buildTaskStateLine` (`read.ts`) прямо велит исполнять шаг и **не
  переспрашивать согласие**, а `resolveTaskState` форсит `actor='agent'` даже если анализатор вернул
  `actor='user'`; это убирает повторные запросы подтверждения на каждом шаге. Откат
  `execution → planning` от анализатора игнорируется, если пользователь не просит пересмотреть план
  (`looksLikeCorrection`), а `execution → validation` не принимается от анализатора — на `validation`
  задача уходит только через `advanceAfterRun` после успешного действия, чтобы пайплайн не рвался на
  середине. Анализатор получает в состоянии `approved` и `steps` и правило не переизобретать
  согласованный план. Ручной выход из тупика — действие `approve` (`applyTaskAction`), кнопка
  «Утвердить план» в `TaskStateBar`.
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
  не попадают в историю LLM. Текущие этап/шаг/ожидаемое действие и кнопки
  Утвердить план/Пауза/Продолжить/Отменить — компактной строкой `TaskStateBar` над полем ввода.

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

## MCP (Day 16–20)

- **Четыре stdio-сервера** (спавн-процессы, приложение их не импортирует):
  `mcp/server.ts` + `mcp/tools.ts` + `mcp/db.ts` — `agent-mcp-demo`, read-only `agent.sqlite`
  (`db_overview`, `bookings_by_room`, `employee_schedule`, `now`, `echo`);
  `mcp/jobs/server.ts` + `mcp/jobs/{register,db,weather,tools}.ts` — `agent-mcp-jobs`, пишет свой
  `jobs.sqlite` (`schedule_weather_report`, `cancel_schedule`, `list_schedules`, `get_weather_report`,
  `get_weather_at`, `run_due_jobs`);
  `mcp/research/server.ts` + `mcp/research/{register,web,reports,tools}.ts` — `agent-mcp-research`,
  пишет файлы-отчёты (`search`, `summarize`, `save_to_file`, `list_reports`, `read_report`);
  `mcp/market/server.ts` + `mcp/market/{register,rates,tools}.ts` — `agent-mcp-market`, курс валют
  (`exchange_rate`, Frankfurter/ECB без ключа).
- **Сборка**: `npm run build:mcp` (`scripts/build-mcp.mjs`, esbuild) бандлит все входы в
  `dist/server/mcp/{mcp-demo,mcp-jobs,mcp-research,mcp-market}.mjs`
  (`--platform=node --format=esm --packages=external`).
  `npm run build` = `vite build && build:mcp`. В dev/test вход отдаётся исходным `.ts` (Node ≥22 type
  stripping), поэтому относительные импорты в `domain/{jobs,research,market}/**` и
  `mcp/{jobs,research,market}/**` — с явным `.ts`.
- **Registry**: `server/mcp-registry.server.ts` — `SPECS: Record<McpServerKind, …>` (name, entry,
  `childEnv`, `hiddenTools`, env-key); `McpServerKind = 'demo' | 'jobs' | 'research' | 'market'`;
  `resolveMcpEntry(kind)`: env-override (`AGENT_MCP_DEMO_ENTRY`/`AGENT_MCP_JOBS_ENTRY`/
  `AGENT_MCP_RESEARCH_ENTRY`/`AGENT_MCP_MARKET_ENTRY`) → `dist/server/mcp/*.mjs` (через `process.cwd()`,
  т.к. в билде серверные чанки лежат в `dist/server/assets`) → dev-исходник. В дочерний процесс
  форвардятся только `AGENT_DB_PATH`/`JOBS_DB_PATH`/`REPORTS_DIR`.
- **Клиент**: `server/mcp.server.ts` — `withClient(entry, env)`, `listToolsFor(config)` и
  `callToolOn(config, name, args)`; `listMcpTools()` сливает инструменты серверов, сбой одного
  деградирует построчно; `callTool(name)` маршрутизирует по имени, `callToolOnServer(kind, …)` — явно.
  Вызовы инструментов маршрутизируются по своему серверу через замыкание в `mcp-tools.server.ts`
  (`loadMcpTools()` собирает `buildMcpAgentTools(visible, (name, args) => callToolOn(config, name, args))`).
- **Интеграция с агентом**: `server/mcp-tools.server.ts` собирает `loadMcpTools()` per-server и
  исключает `hiddenTools` (`run_due_jobs` агенту не предлагается). `domain/mcp/agent-tools.ts`
  добавляет префикс `mcp_`, провенанс сервера в describe (`[research] …` — из `descriptor.server`) и
  обрезает текст отчёта до 4000 символов. Мутируемость приходит аннотацией MCP: каждый сервер
  помечает инструменты `annotations: { readOnlyHint }`, хост в `toDescriptor` вычисляет
  `descriptor.mutating` (readOnlyHint ≠ true → изменяющий, fail-closed), а `buildMcpAgentTools`
  кладёт его в `AgentTool.mutating`. Поэтому мутации `mcp_schedule_weather_report`/`mcp_cancel_schedule`/
  `mcp_save_to_file` под тем же гейтом Этапа, что и внутренние, без хардкода имён. Справочные `mcp_*`
  доступны везде. Добавление/переименование MCP-инструмента не требует правок в `domain/`.
- **Pipeline (Day 19)**: `search → summarize → save_to_file` ведёт обычный цикл `decide→act` (до
  `maxActionsPerTurn`); отдельного движка пайплайна нет. Данные между инструментами ходят
  **ссылками на вывод** `{"$ref": "<output_id>"}` / `{"$ref": "last"}` (массив `["1","2"]` объединяет
  выводы): хост в `resolveArgRefs` (`domain/agent.ts`) подставляет сохранённый текст перед вызовом,
  поэтому модель не копирует крупные тексты в decide и её ответ не обрезается по `max_tokens`. В
  отчёте инструмента возвращается `output_id` и подсказка. `search` — Wikipedia ru через инъектируемый `WebSource`
  (`mcp/research/web.ts`): `generator=search` + `prop=extracts` отдаёт лид статьи и URL; флаг `full`
  переключает на расширенный фрагмент статьи (`exchars`, до 4000 символов), чтобы набрать сырьё под
  большой объём. `summarize` (`domain/research/summarize.ts`, без LLM) — **верное** экстрактивное
  сжатие: выход есть подмножество исходных предложений дословно, в исходном порядке, с сохранением
  границ и ссылок источников; выбираются связные предложения (лид источника входит всегда), поэтому
  оговорка/статус не отрывается от перечисления. Объём — необязательный `targetWords` (из плана/
  запроса), иначе эвристика по контексту. При заданном `targetWords` выбор идёт только по словам (без
  потолка в 15 предложений; safety-bound `SUMMARIZE_MAX_WORDS`). Если источника не хватает, инструмент
  не падает: возвращает максимум возможного и помечает недостачу `[Объём: N из M слов]` — тогда агент
  сам добирает источники (`search full: true` / больше запросов) и повторяет `summarize`, не спрашивая
  пользователя; объём — цель, а не гарантия, выдумывать/переписывать факты запрещено (защита от
  подсунутого моделью пересказа). `save_to_file` пишет `.md` в `REPORTS_DIR` дословно, срезая
  служебную пометку объёма (injectable `ReportsStore`, санитайз имени). Так как `save_to_file`
  мутирующий, цепочка целиком идёт на стадии `execution` +`approved`, а `list_reports`/`read_report`
  подтверждают результат на `validation`. Успешная мутация переводит `execution → validation`
  терминально (один раз, `advanceAfterRun`); справочные действия шаг не двигают. Контракт пайплайна
  («сырой search → в summarize ссылкой, вывод summarize → в save_to_file ссылкой, сам не пересказывай,
  при недостаче добери источников») проговорён в `DECIDE_TOOL_HINTS` (`domain/agent.ts`) и в описаниях
  инструментов (`mcp/research/register.ts`).
- **Orchestration (Day 20)**: `agent-mcp-market` (`exchange_rate { base?, quote?, date? }`, дефолт
  EUR/USD) — отдельный сервер, который агент комбинирует с остальными. Длинный флоу на одном ходу
  (например `db_overview`/`search`/`get_weather_report`/`exchange_rate` → `summarize` → `save_to_file`
  → `list_reports`) ведёт тот же цикл `decide→act`; выбор сервера и порядок вызовов задают
  описания инструментов, а данные между ними ходят ссылками `$ref` на выводы инструментов цикла.


- **Jobs (Day 18)**: `domain/jobs/` — города (белый список, tz `Europe/Moscow`), `WeatherSource`
  (инъекция), агрегаты (min/сред/макс), расписание (интервал 15–1440 мин, окно 1–720 ч, ≤5 расписаний),
  покрытие. Open-Meteo (`mcp/jobs/weather.ts`) без ключа: `current` для live и `hourly&past_days=7` для
  bootstrap. `jobs.sqlite`: `schedules`/`runs`/`summaries`/`meta`, ретеншн 30 дней / 5000 прогонов,
  `0600`. Bootstrap — **per-city при создании первого расписания** (маркер `coverage:<city>` в `meta`).
  `get_weather_at` — ближайший сэмпл в пределах ±½ интервала его расписания, иначе честное «данных нет».
- **Тик**: systemd timer раз в 15 минут дёргает серверный роут `GET /jobs/tick`
  (`routes/jobs.tick.ts` → `server/jobs.server.ts` → MCP `run_due_jobs`). Долгоживущего планировщика
  нет; тот же путь у кнопки «Выполнить сейчас» (`functions/run-jobs.functions.ts`).
- UI: `components/McpPanel.tsx` (вкладка «MCP») + секция «Расписания» (`SchedulesPanel`, `ScheduleCard`,
  `JobRunRow`, `api/use-jobs.ts`). Тесты: `tests/mcp.test.ts` (все серверы), `tests/mcp-jobs.test.ts`
  (инъекция `WeatherSource` + временная БД), `tests/mcp-research.test.ts` (инъекция `WebSource` +
  temp `REPORTS_DIR`), `tests/mcp-market.test.ts` (инъекция `MarketSource`), `tests/mcp-chain.test.ts`
  (цепочка search→summarize→save), `tests/mcp-orchestration.test.ts` (кросс-серверный флоу),
  `tests/mcp-agent.test.ts` (адаптер + `executeAgent`). Сетевые тесты Open-Meteo/Wikipedia/Frankfurter —
  только под `RUN_NETWORK_TESTS=1`.

## Персистентность

- `server/store/db.server.ts` — singleton `node:sqlite` (схема, сиды, миграции). `node:sqlite`
  импортируется только динамически (`await import`) внутри `.server.ts`, чтобы не попасть в
  клиентский бандл. Хранилище разбито по концептам: `sessions`, `branches`, `messages`, `facts`,
  `memory`, `people`, `tasks`, `invariants`, `profiles`, `agent-records`; баррель `store.server.ts`
  удалён — импортируйте нужный концептный модуль напрямую.
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

Env: `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `HUGGING_FACE_TOKEN`; путь БД —
`AGENT_DB_PATH` (по умолчанию `~/.ai-advent-challenge/agent.sqlite`); для jobs — `JOBS_DB_PATH`
(по умолчанию `~/.ai-advent-challenge/jobs.sqlite`); для research — `REPORTS_DIR`
(по умолчанию `~/.ai-advent-challenge/reports`) и опциональные
`AGENT_MCP_DEMO_ENTRY`/`AGENT_MCP_JOBS_ENTRY`/`AGENT_MCP_RESEARCH_ENTRY`/`AGENT_MCP_MARKET_ENTRY`.

## Как портировать

1. Скопировать `src/features/agent/` целиком.
2. Скопировать внешние зависимости из списка выше.
3. Завести роут `/agent`, рендерящий `pages/AgentPage` (и, при желании, редиректы со старых путей).
4. Прописать env и поднять `QueryClientProvider`.
5. Для MCP: Node ≥22; собрать бандлы (`npm run build:mcp`) и/или задать
   `AGENT_MCP_DEMO_ENTRY`/`AGENT_MCP_JOBS_ENTRY`/`AGENT_MCP_RESEARCH_ENTRY`/`AGENT_MCP_MARKET_ENTRY`;
   форвардить `AGENT_DB_PATH`/`JOBS_DB_PATH`/`REPORTS_DIR` в дочерние процессы; поднять `GET /jobs/tick`
   по таймеру. Деплой — `deploy/` (systemd + timer, Tailscale-only).
6. Прогнать `npm run test` — тесты фичи офлайн (мокают LLM через `tests/agent-testkit.ts`).

Правила, за которые лучше не выходить: серверные ключи никогда не уходят в браузер; `node:sqlite`
импортируется только динамически внутри `.server.ts`; MCP SDK не доходит ни до LLM-транспорта, ни до
браузера; промпты/тексты лежат в `data/`/`domain/`, а не в `functions/`.
