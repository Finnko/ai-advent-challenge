# Project: AI Advent Challenge

Daily AI-learning steps. Each day is a branch `feature/dayN`; current work: Day 17 (`feature/day17`).
Days 13–17 extend the unified `/agent` workspace with task state, invariants and MCP.

## Where to read more

- `src/features/agent/README.md` — mechanics of the agent feature: turn execution, tools, task state
  machine, invariants, context strategies, memory, profile, persistence and MCP, plus porting notes.
  Read it before editing any of those.
- `CONTEXT.md` — domain vocabulary (Ход, Задача, Этап, Инвариант, …).
- `README.md` — day-by-day log of the challenge.

## Stack

- **TanStack Start** (Vite + React 19 + TypeScript), file-based routing (`src/routes`).
- **Tailwind v4** via `@tailwindcss/vite`. Tokens/theme (`data-theme`, light/dark) in `src/styles.css`.
- Styling: bare Tailwind + semantic tokens (`.demo-*`/`.island-*` kit). Slate palette + indigo accents;
  `--positive`/`--danger` reserved for meaning. Add a component library only when asked.
- **MCP SDK** (`@modelcontextprotocol/sdk` + `zod`) is the one allowed non-LLM SDK; it lives only in the
  MCP server/client modules. The LLM transport stays raw `fetch`.

## Layout

- `src/features/agent/` — the agent feature, self-contained for porting:
  `pages/` (public surface), `api/` (react-query hooks), `functions/` (`createServerFn`),
  `server/` (deep `.server.ts` modules: `agent-turn`, `agent-service`, `task-state`, `mcp`, `mcp-tools`,
  `mcp-registry`, `jobs`; plus `store.server.ts` and the `store/` folder), `domain/` (isomorphic logic:
  `agent`, `agent-tools`, `context/`, `memory/`, `profile/`, `session/`, `task/`, `invariants/`, `mcp/`,
  `jobs/`, `tokens`),
  `mcp/` (standalone stdio MCP server processes — spawned, never imported/bundled): `server|tools|db`
  (`agent-mcp-demo`, read-only `agent.sqlite`) and `jobs/` (`agent-mcp-jobs`, own `jobs.sqlite`),
  `data/` (client-safe data), `components/`, `tests/`.
- `src/lib/` — shared: `llm.ts`/`llm.server.ts` (transport), `functions/*.functions.ts` (Days 1–5 server
  fns + shared `validation.ts`), `day2.ts`…`day5.ts`, `days.ts` (sidebar), `utils.ts` (`cn`).
- `src/components/` — app shell (`Header`, `Sidebar`, `Chat`) and shared `ui/Tabs.tsx`.
- `src/routes/` — thin route wrappers. The unified `/agent` renders `pages/AgentPage`; the old
  `/agent-strategies|memory|profile` routes are `beforeLoad` redirect stubs to `/agent`.

## Hard rules

- **Server & LLM**: keep the LLM transport on raw `fetch`, wrapped by the generic
  `callCompletions(endpoint, apiKey, messages, params)`. Read secrets server-side from `process.env`
  (`DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `HUGGING_FACE_TOKEN`) and keep them out of the browser bundle
  (ids only, no `VITE_` keys, no `import.meta.env`). Each `createServerFn` is a thin adapter:
  `validator → delegate` to a deep module. Server-only modules use the `.server.ts` suffix; client-safe
  prompt/text data lives in `dayN.ts` / feature `data/`.
- **The client sends ids, not content** — tier / strategy / session. Invariant CRUD is the explicit
  exception: the rule itself is user-managed data and is sent to its CRUD function.
- **Persistence**: `features/agent/server/store.server.ts` is a `node:sqlite` singleton. Import
  `node:sqlite` dynamically (`await import`) inside a `.server.ts`.
- **Session config is immutable**: strategy, memory, profile, window size and task state are fixed by
  `createSession` and read by `runAgentTurn`; a different config means a new session.
- **Invariants are global per token** and enforced deterministically before mutating tools and after
  finalize; the opt-in `invariantGuard` is a fallback, never a replacement. Pinned `slug`/`check` are
  immutable.
- **MCP tools**: `agent-mcp-demo` is read-only; `agent-mcp-jobs` writes its own `jobs.sqlite`. Mutating
  MCP tools (`mcp_schedule_weather_report`, `mcp_cancel_schedule`) obey the same task-stage gate as
  internal mutations; reference MCP tools stay available in every stage. Discovery/listing degrades per
  server (a dead server removes only its tools). The MCP SDK reaches neither the LLM transport nor the
  browser. MCP servers ship as compiled `.mjs` (`npm run build:mcp`), resolved by
  `server/mcp-registry.server.ts` via `AGENT_MCP_DEMO_ENTRY`/`AGENT_MCP_JOBS_ENTRY` → `dist` → dev source.
- **Conventions**: write no comments unless asked. Extract a decision into a small named function with
  early returns instead of nested ternaries or long `if/else if` ladders. Respond one chunk at a time
  (no streaming yet; the UI shows a 3-dots animation). Offline tests live in `src/**/*.test.ts`
  (Vitest, node env; the agent testkit is an in-memory `AgentStore`); they stay offline by default
  through injection (e.g. `WeatherSource`, temp sqlite), and real-network tests run only under
  `RUN_NETWORK_TESTS=1`. `npm run test` must stay green. Out of scope: streaming, a real auth/backend
  for `people` (a seeded mock today). Work on `feature/dayN` branches; commit only when asked.
  Deployment lives in `deploy/` (systemd + timer, Tailscale-only).

## Commands

```bash
npm run dev             # dev server, http://localhost:3000
npm run build           # production build (vite build) + MCP bundles (build:mcp)
npm run build:mcp       # esbuild MCP servers → dist/server/mcp/*.mjs
npm run test            # vitest run (offline; network tests behind RUN_NETWORK_TESTS=1)
npm run lint            # oxlint
npx tsc --noEmit        # typecheck
npm run generate-routes # regenerate route tree after adding routes
```

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
