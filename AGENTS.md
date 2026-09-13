# Project: AI Advent Challenge

Daily AI-learning steps. Each day is a branch `feature/dayN`; current work: Day 9 (`feature/day9`).

## Stack

- **TanStack Start** (Vite + React 19 + TypeScript), file-based routing (`src/routes`).
- **Tailwind v4** via `@tailwindcss/vite`. App-wide tokens and `data-theme` (light/dark) live in `src/styles.css`.
- Styling: bare Tailwind utility classes + semantic CSS variables in `src/styles.css` (`.demo-*`/`.island-*` kit + tokens). Palette: slate (near-white `Slate-50` bg, `Slate-900` headings, `Slate-700` body, `Slate-500` secondary) with indigo accents; `Emerald`/`Red` reserved for meaning (positive/error). Tokens: text `--ink`/`--ink-soft`/`--ink-muted`; accents `--accent`/`--accent-strong`/`--accent-soft`; surfaces `--surface`/`--surface-strong`/`--surface-tint`; lines `--line`/`--line-strong`; status `--positive`/`--info`/`--danger`/`--warn`; shell `--bg-base`/`--header-bg`/`--label`. Do not pull in component libraries unless asked.

## LLM layer (Day 1)

- The raw HTTP transport lives in `src/lib/llm.server.ts`; client-safe LLM types/data live in
  `src/lib/llm.ts`. Each `createServerFn` wrapper gets its own file in `src/lib/functions/*.functions.ts`
  (thin adapters: `validator → delegate`), shared wire types live in `src/lib/api.ts`, and shared
  input validators in `src/lib/functions/validation.ts`. Agent orchestration lives in
  `src/lib/agent-service.server.ts`; persistence in `src/lib/store.server.ts`. Server-only modules use
  the `.server.ts` suffix (import protection); client-safe prompt data lives in `dayN.ts`.
- **Raw `fetch` only — no SDKs.** Days 1–4 hit `https://api.deepseek.com/chat/completions`;
  Day 5 additionally hits the Hugging Face router `https://router.huggingface.co/v1/chat/completions`
  for the weak tier. Do not add `openai`, `deepseek`, or any LLM dependency.
- Secrets are read server-side from `process.env` (`DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`,
  `HUGGING_FACE_TOKEN`). **Keys must never ship to the browser** — no `VITE_`-prefixed key,
  no `import.meta.env` exposure.
- `.env` is gitignored; `.env.example` is the committed template.
- `llm.server.ts` exports the generic `callCompletions(endpoint, apiKey, messages, params)`
  (OpenAI-compatible: DeepSeek + HF router) and `requireEnv`/`apiKeyFor`; `llm.ts` exports
  `TIER_ENDPOINTS` (server-side routing) and the `ChatResult`/`ChatUsage`/`Tier`/`AskParams` types.
  `functions/*.functions.ts` wrap them in server fns:
  - `chat` (day1/day2 modes, config in `day2.ts`) and generic `ask({ system, user, params? })` used by day3/day4 to
    compose multi-step strategies on the client. `ask` params accept optional `temperature`
    (validated 0–2, sent only when given). `ChatResult` returns `model` and server-measured `latencyMs`.
  - `askModel({ tier, system, user })` for Day 5: client sends only `tier: 'weak' | 'medium' | 'strong'`;
    the tier→endpoint/model/key mapping (`TIER_ENDPOINTS`) lives server-side in `llm.ts`
    (weak = `Qwen/Qwen3-8B` via HF, medium = `deepseek-flash`, strong = `deepseek-v4-pro`).
    Client can never pass arbitrary model strings.
  - `readBrief` (reads `md/design/brief.md` from `process.cwd()`) and `saveProposal`
    (writes responses to `md/design/proposals/`) — Day 5's brief/proposals are a **local, gitignored**
    `md/` folder, not part of the repo, so these only work in local dev where that folder exists.
  - Agent (Day 6/7) server fns: `resolveCapabilities({ token })`, `listOrg()`, and the persistence
    set `listSessions({ token })` / `loadSession({ sessionId })` / `deleteSession({ sessionId })`
    and `runAgent({ token, sessionId: number | null, user, strategy? })` (auto-creates a
    session when `sessionId` is null, replays stored history into the LLM, and persists both new
    messages). `runAgent` resolves the context strategy from the `strategy` id and delegates to
    `agent-service.server.executeAgent`; an API failure (e.g. raw 400 on a huge prompt) becomes a
    graceful blocked `AgentRunResult`, never a thrown error.
  - Day 9/10 adds `compareCompression({ token, sessionId, user })`: loads history, runs the request
    **twice** through the `summary` and `none` context strategies, persists nothing, returns both
    `AgentRunResult`s plus the summarizer usage `auxUsage` (for the A/B price delta).
- **Day 8 token accounting** lives in `src/lib/tokens.ts` (isomorphic, no env): `estimateTokens`
  uses `gpt-tokenizer` (pure TS — the only new npm dep; counts offline, runs client + server).
  Constants: `CONTEXT_BUDGET_TOKENS = 4096` (a deliberately small budget the agent **enforces on
  itself** to demo overflow — the real `deepseek-flash` context is 1M, see `MODEL_CONTEXT_TOKENS`),
  off-peak DeepSeek prices `PRICE_INPUT_PER_1M = 0.15`, `PRICE_INPUT_CACHE_HIT_PER_1M = 0.003`,
  `PRICE_OUTPUT_PER_1M = 0.6` (+`costUsd`, `savedUsd`, `formatUsd`). In `src/lib/agent.ts`:
  `Agent.run` estimates `system + request` and refuses a single over-budget request (no more
  trimming — Day 9 replaced `fitHistory`/`enforceContextBudget` with compression). Input policy cap
  is `MAX_INPUT_CHARS = 30_000` — high enough that the budget refusal (not input policy) is what the
  demo hits. `AgentRunResult` carries `tokens: TokenBreakdown` (`requestTokens`/`historyTokens` are
  local estimates — labels «оценка»; `responseTokens` = real API completion summed over
  decide+finalize; `promptTokensActual` is the real API prompt; `contextTokens`/`contextMessages`
  describe the context blocks the strategy attached (`AgentRunResult.contextNote` carries the
  display note); `cacheHitTokens`/`cacheMissTokens` come from the API usage and
  drive cache-aware `costUsd`; `historyTokensSent` is what the caller handed to the agent).
- **Day 9/10 context strategies** live behind a seam in `src/lib/context/` (preparation for
  Day 10's three strategies; only `summary` and `none` are implemented so far). `context/types.ts`
  defines `ContextStrategyId = 'summary' | 'none'`, `ContextStrategy { id, label, description,
  prepare(input) }`, `PrepareInput { rows, previousSummary, summarize, saveSummary }` and
  `PrepareResult { context, auxUsage }`. `context/summary.ts` wraps `compression.ts`
  (`prepareHistoryWithSummary`) and returns `PreparedContext.blocks = [{ kind: 'summary', content }]`
  plus a `note`; `context/none.ts` returns the full history with no blocks; `context/registry.ts`
  maps id → strategy (`CONTEXT_STRATEGIES`, `resolveStrategy`). The client sends only a strategy id,
  never a model/prompt string.
  `src/lib/compression.ts` stays pure (no env/fetch — tests are offline): `KEEP_RECENT_MESSAGES = 6`,
  `SUMMARY_CHUNK_MESSAGES = 10`. `splitHistory(rows, keep)` keeps the tail but aligns it to the start
  of a user turn; `pendingToSummarize(agedOut, through)` gives the not-yet-summarized prefix;
  `shouldRefresh(count)` = `count >= M`; `buildSummaryMessages` builds the summarizer prompt;
  `prepareHistoryWithSummary(...)` orchestrates incremental summarization (new summary = previous +
  new chunk) and returns `{ history, summary, summarizedMessages, summaryUsage, throughMessageId,
  refreshed }` without persisting (the strategy calls the injected `saveSummary`). `store.server.ts` has
  `session_summaries` (watermark `through_message_id`) with `getSessionSummary`/`upsertSessionSummary`;
  `loadMessages` returns message `id`s. `summarizeHistory` = flash @0.2 lives in `agent-service.server.ts`.
  In `agent.ts`, `Agent.run(user, prepared: PreparedContext = EMPTY_CONTEXT)`; `PreparedContext =
  { history, blocks, note }` (`SystemBlock = { kind: 'summary' | 'facts', content }`,
  `ContextNote = { kind, label, text, messages, throughMessageId }`). `AgentConfig` no longer knows
  about summaries — it inserts `prepared.blocks` as **separate `system` messages** after
  `buildBaseSystem` and before the raw history in **both** decide and finalize. Cache-oriented
  rebuild is preserved: base system is byte-identical across stages
  (identity/today/subordinates/colleagues/hardening), volatile content (tool list, rooms, `context`,
  stage instruction) moved to the **last user message**; `finalize` sends raw history only when there
  is **no tool report** (with a report: `system + blocks + request+report`). Cache fields from both
  calls are summed into `usage`. `src/lib/accounting.ts` (`accountSession`, `summaryCostUsd`,
  client-safe) is the single source for the per-answer badges and the session sum, so they agree.
  `src/lib/agent-service.server.ts` (server-only) owns `resolveCapabilitiesByToken`, `buildAgentContext`,
  `callFlash`, `summarizeHistory`, `todayIso` and `executeAgent({ capabilities, user, strategy, rows,
  previousSummary, saveSummary })`, which prepares the context, runs the `Agent` and returns
  `{ run, auxUsage }` (blocked gracefully on failure). `functions/*.functions.ts` only register server fns.
- **Meeting domain (bookings).** `bookings` stores `title`/`duration_min` (default 60) and
  `participants` (JSON array, default `[]`) — migration via `PRAGMA table_info` + `ALTER TABLE`; mock
  meetings are seeded at startup (`BOOKINGS_SEED`). 8 rooms (`ROOMS`) are listed in the `decide` prompt;
  every room has a fixed capacity `ROOM_CAPACITY = 5` (no per-booking capacity arg).
  Tools: `bookMeetingRoom` (room/date/time/duration/title, refuses on interval overlap via
  `store.findOverlap`), `listBookings` (own + team for managers, plus meetings where the user is a
  participant; prints participants), `listAvailableRooms`
  (free/busy rooms for a date/time/duration via `store.listBookingsOnDate`), `inviteToMeeting` (adds
  participants to an existing booking by room/date/time; organizer or their manager; validates names
  against `identity.colleagues` = seeded `people`; refuses when the group exceeds `ROOM_CAPACITY`), `cancelBooking`
  (natural key room/date/time; managers may cancel subordinates'). `BookingRecord` carries
  `title`/`durationMin`/`participants`. The agent runs **one tool per message** (`decide → act → finalize`),
  so booking and inviting are two separate messages. To keep tool selection reliable, `runAgent` builds a
  `context` string (last meeting the user can manage via `store.latestManagedBookingFor`; last pending vacation for a manager via
  `store.latestPendingVacation`) and passes it as `AgentConfig.context`; the decide prompt tells the model
  to take room/date/time (or employee/dates) from it instead of asking again. `inviteToMeeting` falls back
  to the user's latest managed booking when room/date/time are omitted; `cancelBooking` falls back to it too;
  `approveVacation` falls back to the latest
  pending subordinate request. As a safety net, when `decide` returns `tool: null` for an action-like
  request (`looksLikeAction` keyword check), the agent retries `decide` once with a nudge — so a follow-up
  like «отмени эту встречу» / «позови Ивана» / «подтверди эту заявку» resolves from context instead of
  falling through. Room names match case/prefix-insensitively (`resolveRoom` strips the
  «Переговорка/Лаундж/Комната» prefix and a trailing Russian vowel, so «Ладогу» resolves). `listVacations`
  output does NOT include reference codes (avoids a bogus «Код подтверждения» line on list answers).
- **Day 7 persistence** lives in `src/lib/store.server.ts`, a server-only `node:sqlite` singleton (raw
  `DatabaseSync`, no npm dependency; emits an `ExperimentalWarning`, fine). DB file:
  `~/.ai-advent-challenge/agent.sqlite` (override via `AGENT_DB_PATH`), so it survives `git clean`,
  branch switches and deleting the repo-local `data/`. On first open the legacy `data/agent.sqlite`
  is migrated to the new path if present; before touching an existing DB it is snapshotted to
  `<db>.backups/agent-<timestamp>.sqlite` (last 5 kept). Tables: `people` (org seeded mock: Анна + Пётр/Мария/Иван
  via `manager_token`), `sessions`, `messages` (`run_json` holds the full `AgentRunResult`),
  `vacations`, `bookings`. **Never import `node:sqlite` statically in client-reachable code** —
  always `await import('node:sqlite')` inside server functions (same pattern as `node:fs/promises`);
  the `.server.ts` suffix additionally blocks accidental client imports.
  Client-facing UI for the agent lives in `src/lib/agent-ui.ts` (safe data only).
- The agent demo is a **single live route `/agent`** (renamed from `/day6`) — Day 7 added memory to
  it rather than a second page. Sidebar labels in `src/lib/days.ts` are semantic
  (`Base LLM API`, …, `Agent`), not `Day N`. In `src/lib/agent.ts`: `LlmMessage.role` includes
  `'assistant'`, `AgentIdentity.subordinates: string[]`, `Agent.run(user, prepared?)` replays the
  prepared history and context blocks into `decide`/`finalize`. Tool definitions/runners and the role→tool map live in
  `src/lib/agent-tools.ts` (`TOOL_DEFINITIONS`, `TOOLS_BY_ROLE`, `createAgentTools(store: AgentStore)`);
  `TOOLS_BY_ROLE` is derived from each tool's `roles`, so `resolveCapabilities`, the `decide` prompt
  and `isPermitted` can never drift from the actual tools. Effects are persisted through the injected
  store; `listVacations` answers memory questions from DB.
- Client-safe prompt/task text (no env) belongs in `src/lib/dayN.ts` (`day2.ts`…`day5.ts`) /
  `src/lib/agent-ui.ts`; shared wire types in `src/lib/api.ts`. Never put prompt text in
  `functions/*.functions.ts` / `agent-service.server.ts` / `llm.server.ts` / `store.server.ts`.

## Commands

```bash
npm run dev             # dev server, http://localhost:3000
npm run build           # production build (vite build)
npm run test            # vitest run (offline: tools + agent pipeline)
npm run generate-routes # regenerate route tree after adding routes
```

## Conventions

- No comments in code unless asked.
- Respond one chunk at a time (no streaming yet); the UI shows a 3-dots animation while waiting.
- Offline tests live in `src/lib/*.test.ts` (Vitest, node env; `agent-testkit.ts` is an in-memory
  `AgentStore`). `npm run test` must stay green; no network/API calls in tests.
- Out of scope for now: streaming, deployment, a real auth/backend for `people` (today a seeded mock).
- Work happens on `feature/dayN` branches; commit only when asked.

<!-- intent-skills:start -->
# TanStack Intent - before editing files, run the matching guidance command.
tanstackIntent:
  - id: "@tanstack/devtools#devtools-app-setup"
    run: "npx @tanstack/intent@latest load @tanstack/devtools#devtools-app-setup"
    for: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
  - id: "@tanstack/devtools#devtools-marketplace"
    run: "npx @tanstack/intent@latest load @tanstack/devtools#devtools-marketplace"
    for: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
  - id: "@tanstack/devtools#devtools-plugin-panel"
    run: "npx @tanstack/intent@latest load @tanstack/devtools#devtools-plugin-panel"
    for: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
  - id: "@tanstack/devtools#devtools-production"
    run: "npx @tanstack/intent@latest load @tanstack/devtools#devtools-production"
    for: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
  - id: "@tanstack/devtools-event-client#devtools-bidirectional"
    run: "npx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-bidirectional"
    for: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
  - id: "@tanstack/devtools-event-client#devtools-event-client"
    run: "npx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-event-client"
    for: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
  - id: "@tanstack/devtools-event-client#devtools-instrumentation"
    run: "npx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-instrumentation"
    for: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
  - id: "@tanstack/devtools-vite#devtools-vite-plugin"
    run: "npx @tanstack/intent@latest load @tanstack/devtools-vite#devtools-vite-plugin"
    for: "Configure @tanstack/devtools-vite for source inspection (data-tsd-source, inspectHotkey, ignore patterns), console piping (client-to-server, server-to-client, levels), enhanced logging, server event bus (port, host, HTTPS), production stripping (removeDevtoolsOnBuild), editor integration (launch-editor, custom editor.open). Must be FIRST plugin in Vite config. Vite ^6 || ^7 only."
  - id: "@tanstack/react-start#lifecycle/migrate-from-nextjs"
    run: "npx @tanstack/intent@latest load @tanstack/react-start#lifecycle/migrate-from-nextjs"
    for: "Step-by-step migration from Next.js App Router to TanStack Start: route definition conversion, API mapping, server function conversion from Server Actions, middleware conversion, data fetching pattern changes."
  - id: "@tanstack/react-start#react-start"
    run: "npx @tanstack/intent@latest load @tanstack/react-start#react-start"
    for: "React bindings for TanStack Start: createStart, StartClient, StartServer, React-specific imports, re-exports from @tanstack/react-router, full project setup with React, useServerFn hook."
  - id: "@tanstack/react-start#react-start/server-components"
    run: "npx @tanstack/intent@latest load @tanstack/react-start#react-start/server-components"
    for: "Implement, review, debug, and refactor TanStack Start React Server Components in React 19 apps. Use when tasks mention @tanstack/react-start/rsc, renderServerComponent, createCompositeComponent, CompositeComponent, renderToReadableStream, createFromReadableStream, createFromFetch, Composite Components, React Flight streams, loader or query owned RSC caching, router.invalidate, structuralSharing: false, selective SSR, stale names like renderRsc or .validator, or migration from Next App Router RSC patterns. Do not use for generic SSR or non-TanStack RSC frameworks except brief comparison."
  - id: "@tanstack/router-core#router-core"
    run: "npx @tanstack/intent@latest load @tanstack/router-core#router-core"
    for: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
  - id: "@tanstack/router-core#router-core/auth-and-guards"
    run: "npx @tanstack/intent@latest load @tanstack/router-core#router-core/auth-and-guards"
    for: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
  - id: "@tanstack/router-core#router-core/code-splitting"
    run: "npx @tanstack/intent@latest load @tanstack/router-core#router-core/code-splitting"
    for: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
  - id: "@tanstack/router-core#router-core/data-loading"
    run: "npx @tanstack/intent@latest load @tanstack/router-core#router-core/data-loading"
    for: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
  - id: "@tanstack/router-core#router-core/navigation"
    run: "npx @tanstack/intent@latest load @tanstack/router-core#router-core/navigation"
    for: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
  - id: "@tanstack/router-core#router-core/not-found-and-errors"
    run: "npx @tanstack/intent@latest load @tanstack/router-core#router-core/not-found-and-errors"
    for: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
  - id: "@tanstack/router-core#router-core/path-params"
    run: "npx @tanstack/intent@latest load @tanstack/router-core#router-core/path-params"
    for: "Dynamic path segments ($paramName), splat routes ($ / _splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
  - id: "@tanstack/router-core#router-core/search-params"
    run: "npx @tanstack/intent@latest load @tanstack/router-core#router-core/search-params"
    for: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
  - id: "@tanstack/router-core#router-core/ssr"
    run: "npx @tanstack/intent@latest load @tanstack/router-core#router-core/ssr"
    for: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
  - id: "@tanstack/router-core#router-core/type-safety"
    run: "npx @tanstack/intent@latest load @tanstack/router-core#router-core/type-safety"
    for: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
  - id: "@tanstack/router-plugin#router-plugin"
    run: "npx @tanstack/intent@latest load @tanstack/router-plugin#router-plugin"
    for: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
  - id: "@tanstack/start-client-core#start-core"
    run: "npx @tanstack/intent@latest load @tanstack/start-client-core#start-core"
    for: "Core overview for TanStack Start: tanstackStart() Vite plugin, getRouter() factory, root route document shell (HeadContent, Scripts, Outlet), client/server entry points, routeTree.gen.ts, tsconfig configuration. Entry point for all Start skills."
  - id: "@tanstack/start-client-core#start-core/auth-server-primitives"
    run: "npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/auth-server-primitives"
    for: "Server-side authentication primitives for TanStack Start: session cookies (HttpOnly, Secure, SameSite, __Host- prefix), session read/issue/destroy via createServerFn and middleware, OAuth authorization-code flow with state and PKCE, password-reset enumeration defense, CSRF for non-GET RPCs, rate limiting auth endpoints, session rotation on privilege change. Pairs with router-core/auth-and-guards for the routing side."
  - id: "@tanstack/start-client-core#start-core/deployment"
    run: "npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/deployment"
    for: "Deploy to Cloudflare Workers, Netlify, Vercel, Node.js/Docker, Bun, Railway. Selective SSR (ssr option per route), SPA mode, static prerendering, ISR with Cache-Control headers, SEO and head management."
  - id: "@tanstack/start-client-core#start-core/execution-model"
    run: "npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/execution-model"
    for: "Isomorphic-by-default principle, environment boundary functions (createServerFn, createServerOnlyFn, createClientOnlyFn, createIsomorphicFn), ClientOnly component, useHydrated hook, import protection, dead code elimination, environment variable safety (VITE_ prefix, process.env)."
  - id: "@tanstack/start-client-core#start-core/middleware"
    run: "npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/middleware"
    for: "createMiddleware, request middleware (.server only), server function middleware (.client + .server), context passing via next({ context }), sendContext for client-server transfer, global middleware via createStart in src/start.ts, middleware factories, method order enforcement, fetch override precedence."
  - id: "@tanstack/start-client-core#start-core/server-functions"
    run: "npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-functions"
    for: "createServerFn (GET/POST), validator (Zod or function), useServerFn hook, server context utilities (getRequest, getRequestHeader, setResponseHeader, setResponseStatus), error handling (throw errors, redirect, notFound), streaming, FormData handling, file organization (.functions.ts, .server.ts)."
  - id: "@tanstack/start-client-core#start-core/server-routes"
    run: "npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-routes"
    for: "Server-side API endpoints using the server property on createFileRoute, HTTP method handlers (GET, POST, PUT, DELETE), createHandlers for per-handler middleware, handler context (request, params, context), request body parsing, response helpers, file naming for API routes."
  - id: "@tanstack/start-server-core#start-server-core"
    run: "npx @tanstack/intent@latest load @tanstack/start-server-core#start-server-core"
    for: "Server-side runtime for TanStack Start: createStartHandler, request/response utilities (getRequest, setResponseHeader, setCookie, getCookie, useSession), three-phase request handling, AsyncLocalStorage context."
  - id: "@tanstack/virtual-file-routes#virtual-file-routes"
    run: "npx @tanstack/intent@latest load @tanstack/virtual-file-routes#virtual-file-routes"
    for: "Programmatic route tree building as an alternative to filesystem conventions: rootRoute, index, route, layout, physical, defineVirtualSubtreeConfig. Use with TanStack Router plugin's virtualRouteConfig option."
<!-- intent-skills:end -->
