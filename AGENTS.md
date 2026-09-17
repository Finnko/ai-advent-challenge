# Project: AI Advent Challenge

Daily AI-learning steps. Each day is a branch `feature/dayN`; current work: Day 13 (`feature/day13`),
which starts by collapsing the agent demos into one workspace (Days 13–14 features not built yet).

## Stack

- **TanStack Start** (Vite + React 19 + TypeScript), file-based routing (`src/routes`).
- **Tailwind v4** via `@tailwindcss/vite`. Tokens/theme (`data-theme`, light/dark) in `src/styles.css`.
- Styling: bare Tailwind + semantic tokens (`.demo-*`/`.island-*` kit). Slate palette + indigo accents;
  `--positive`/`--danger` reserved for meaning. Don't add component libraries unless asked.

## Layout

- `src/features/agent/` — the agent feature, self-contained for porting (see its `README.md`):
  `pages/` (only public surface), `api/` (react-query hooks), `functions/` (`createServerFn`),
  `server/` (`.server.ts` deep modules: `agent-turn`, `agent-service`, `store`), `domain/` (isomorphic
  logic: `agent`, `agent-tools`, `context/`, `memory/`, `profile/`, `session/`, `tokens`),
  `data/` (client-safe data), `components/`, `tests/`.
- `src/lib/` — shared: `llm.ts`/`llm.server.ts` (transport), `functions/*.functions.ts` (Days 1–5 server
  fns + shared `validation.ts`), `day2.ts`…`day5.ts`, `days.ts` (sidebar), `utils.ts` (`cn`).
- `src/components/` — app shell (`Header`, `Sidebar`, `Chat`) and shared `ui/Tabs.tsx`.
- `src/routes/` — thin route wrappers. The unified `/agent` renders `pages/AgentPage`; the old
  `/agent-strategies|memory|profile` routes are `beforeLoad` redirect stubs to `/agent`.

## Server & LLM rules

- **Raw `fetch` only — no SDKs.** DeepSeek + Hugging Face router, wrapped by the generic
  `callCompletions(endpoint, apiKey, messages, params)`.
- Secrets read server-side from `process.env` (`DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `HUGGING_FACE_TOKEN`).
  **Keys never ship to the browser** — no `VITE_` key, no `import.meta.env`. `.env` gitignored.
- Each `createServerFn` is a thin adapter: `validator → delegate` to a deep module. Server-only modules
  use the `.server.ts` suffix; client-safe prompt/text data lives in `dayN.ts` / feature `data/`, never
  in `functions/` or `.server.ts`.
- The client sends only ids (tier / strategy / session), never model or prompt strings.

## Turn execution & session config (Day 13 refactor)

- `features/agent/server/agent-turn.server.ts` — deep module of a Turn: `runAgentTurn({ token,
  sessionId, user }, deps)` hydrates capabilities/session/active branch/history/summary/facts/
  memory/profile, runs `executeAgent`, then appends the user and assistant messages.
  `functions/run-agent.functions.ts` is only `validator → runAgentTurn(data)`.
- Injectable seam: `TurnDeps = { resolveCapabilities, store: TurnStore, runtime: AgentRuntime,
  now }`; `defaultTurnDeps` is the production wiring. Offline tests pass fakes (`tests/agent-turn.test.ts`).
- `AgentRuntime` (in `agent-service.server.ts`): `{ callLLM, summarize, extractFacts, extractMemories,
  store, createTools }`; `defaultAgentRuntime` wires the DeepSeek transport + `createAgentTools`.
  `executeAgent(options, runtime = defaultAgentRuntime)` no longer builds transport/store itself.
- **Session config is one module**: `domain/session/config.ts` owns `SessionConfig` /
  `SessionConfigInput` / `SessionConfigDraft`, defaults (`sessionConfigInput`,
  `DEFAULT_SESSION_CONFIG_DRAFT`), default-profile resolution (`resolveSessionConfig`),
  draft→input (`sessionConfigDraftToInput`), immutability (`resolveActiveSessionConfig`) and
  `clampWindowSize`. `parseSessionConfigInput` (`functions/validation.ts`) validates the wire shape.
- `store.createSession(token, title, input: Partial<SessionConfigInput>)` delegates configuration
  defaults to `domain/session/config.ts`; profile lookup remains server-side. `api/send-message.ts`
  sends `{ config: SessionConfigInput }`; `pages/AgentPage.tsx` keeps a single `SessionConfigDraft`.
  `null` in the draft means the token's default profile; the UI does not start no-profile sessions.

## Agent behavior

- Tools live in `features/agent/domain/agent-tools.ts`; `TOOLS_BY_ROLE` is derived from each tool's
  `roles`, so capabilities, the decide prompt and `isPermitted` can't drift.
- **One tool per message** (`decide → act → finalize`).
- `executeAgent` builds a small `context` string (last managed booking / pending vacation) and passes it
  as `AgentConfig.context`; `decide` retries once with a nudge when it returns `tool: null` for an
  action-like request.
- Room names resolve case/prefix-insensitively; groups over `ROOM_CAPACITY` are refused; `listVacations`
  output omits reference codes.
- Tools get a `ToolClock` (`createAgentTools(store, now)`); `bookMeetingRoom` refuses slots in the past, and
  `listBookings` hides past meetings by default (override with `includePast`/`from`/`to`).
- An API failure (e.g. raw 400 on a huge prompt) becomes a graceful blocked `AgentRunResult`, never a
  thrown error.

## Unified agent workspace (post-Day 12)

- One route `/agent` (`pages/AgentPage`) with tabs `Диалог | Задача | Инварианты | Настройки`; the last
  two are disabled placeholders for Days 13–14. Old routes redirect. One sidebar entry (`lib/days.ts`).
- **Session config is the backbone** (`sessions.strategy` / `memory_enabled` / `profile_id` /
  `window_size`): fixed by `createSession`, read by `runAgentTurn`, never switchable mid-session. The
  client sends only ids and the chosen config; `api/send-message.ts` creates the session then calls
  `runAgent` (→ `runAgentTurn`).
- Reserved extension fields (no feature code yet): `sessions.task_state_enabled`, `sessions.invariant_set_id`.
  Future seams: `SystemBlock.kind` gains `'invariants' | 'task-state'`; invariants go in stable system
  blocks, task state after history with profile/memory.

## Context strategies

- Seam in `features/agent/domain/context/`: `ContextStrategyId = 'summary' | 'none' | 'window' | 'facts'
  | 'branch'`, `ContextStrategy.prepare(input)` → `PreparedContext { history, blocks, note }`.
- **Strategy is fixed per session** (`sessions.strategy`): set by `createSession`, read by
  `runAgentTurn`; never switchable mid-session.
- Short-term memory is the `window` strategy; the sliding-window size is per session
  (`sessions.window_size`, `PrepareInput.windowSize`, default `WINDOW_SIZE = 10`).
- Strategy blocks are inserted as **separate `system` messages** after the base system and before raw
  history, in both `decide` and `finalize`. Profile and memory blocks go **after** the history, in order
  `profile → long-term → working` (last, right before the user turn) so stale prior replies don't override
  fresher profile/memory. Base system is byte-identical across stages; volatile content (tools, rooms,
  context, stage instruction) goes in the last user message, so the cache prefix survives.
- Pure modules (no env/fetch — offline tests): `compression.ts`, `facts.ts`.

## Memory model (Day 11)

- Three layers, each stored separately: **short-term** = active-branch `messages`; **working** =
  `working_memory` keyed by `session_id`; **long-term** = `long_term_memory` keyed by `token`
  (survives sessions and scenarios).
- Seam in `features/agent/domain/memory/`: `types.ts` (layers/entries), `extract.ts` (LLM candidates
  tagged with a layer), `router.ts` (`MemoryRouter` validates and routes to a layer), `read.ts`
  (merge, long-term cap, system-block assembly).
- Memory blocks are inserted as separate `system` messages in order `long-term → working`, after the
  strategy's blocks and the history (last, right before the user turn). `SystemBlock.kind` covers
  `'working' | 'long-term'`. A precedence line (`MEMORY_PRECEDENCE_LINE`) is added to the last user
  message when memory blocks are present: memory is authoritative over earlier history.
- Memory is fixed per session via `sessions.memory_enabled` (set by `createSession`, read by
  `runAgentTurn`).
  Auto-extraction runs each turn; manual entries (`source='manual'`) survive auto overwrites; long-term
  is capped at `LONG_TERM_LIMIT`.

## User profile (Day 12)

- Seam in `features/agent/domain/profile/`: `types.ts` (fields, limits, labels) and `read.ts`
  (`formatProfileBlock` / `buildProfileBlocks`); stored in the `profiles` table keyed by `token`.
- Profile is **fixed per session** (`sessions.profile_id`): set by `createSession` (explicit id or
  default), read by `runAgentTurn`. `deleteProfile` nulls the sessions and transfers the default
  to the most recent remaining profile; a partial unique index keeps **one default per token**.
- `SystemBlock.kind` includes `'profile'`; the block is inserted after history and before memory, and
  `PROFILE_PRECEDENCE_LINE` is merged into the last user message alongside `MEMORY_PRECEDENCE_LINE`.
- Profile is loaded server-side from the session; the client sends only ids. Limits live in
  `functions/validation.ts` (`requireProfileName`, `optionalProfileField`: name≤60, field≤120,
  constraints≤500, instructions≤1200).

## Persistence

- `features/agent/server/store.server.ts` is a `node:sqlite` singleton. **Never import `node:sqlite`
  statically in client-reachable code** — always `await import('node:sqlite')` inside a `.server.ts`.
- DB path `~/.ai-advent-challenge/agent.sqlite` (override `AGENT_DB_PATH`); legacy `data/agent.sqlite`
  is migrated on first open, and an existing DB is snapshotted to `<db>.backups/` (last 5).
- Migrations are idempotent (`PRAGMA table_info` + `ALTER`). Branches are copy-on-fork; `loadMessages`
  and `appendMessage` are scoped to the active branch. Sessions carry
  `strategy`/`scenario`/`memory_enabled`/`profile_id`/`window_size` (+ reserved `task_state_enabled` /
  `invariant_set_id`); memory lives in `working_memory` and `long_term_memory`, profiles in `profiles`
  (separate from `session_facts`/`session_summaries`).

## Commands

```bash
npm run dev             # dev server, http://localhost:3000
npm run build           # production build (vite build)
npm run test            # vitest run (offline)
npm run lint            # oxlint
npx tsc --noEmit        # typecheck
npm run generate-routes # regenerate route tree after adding routes
```

## Conventions

- No comments in code unless asked.
- Respond one chunk at a time (no streaming yet); the UI shows a 3-dots animation while waiting.
- Offline tests live in `src/**/*.test.ts` (Vitest, node env; the agent testkit is an in-memory
  `AgentStore`). `npm run test` must stay green; no network/API calls in tests.
- Out of scope: streaming, deployment, a real auth/backend for `people` (today a seeded mock).
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
