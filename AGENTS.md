# Project: AI Advent Challenge

Daily AI-learning steps. Each day is a branch `feature/dayN`; current work: Day 23 (`feature/day23`).
Days 13–20 extend the unified `/agent` workspace with task state, invariants and MCP; Day 21 adds the
`/rag` document-index feature; Day 22 adds RAG answers with/without retrieval and a control set; Day 23
adds a second retrieval stage (cross-encoder reranking + relevance threshold) and query rewrite.

## Where to read more

- `src/features/agent/README.md` — mechanics of the agent feature: turn execution, tools, task state
  machine, invariants, context strategies, memory, profile, persistence and MCP, plus porting notes.
  Read it before editing any of those.
- `src/features/rag/README.md` — document indexing: corpus source, chunking strategies, embeddings,
  SQLite index, retrieval, reranking/threshold + query rewrite, and the mode comparison. Read it
  before editing any of those.
- `CONTEXT.md` — domain vocabulary (Ход, Задача, Этап, Инвариант, …).
- `README.md` — day-by-day log of the challenge.

## Stack

- **TanStack Start** (Vite + React 19 + TypeScript), file-based routing (`src/routes`).
- **Tailwind v4** via `@tailwindcss/vite`. Tokens/theme (`data-theme`, light/dark) in `src/styles.css`.
- Styling: bare Tailwind + semantic tokens (`.demo-*`/`.island-*` kit). Slate palette + indigo accents;
  `--positive`/`--danger` reserved for meaning. Add a component library only when asked.
- **SDKs**: keep the LLM transport on raw `fetch`; `@modelcontextprotocol/sdk` + `zod` live only in the
  MCP server/client modules; `@huggingface/transformers` (local ONNX) lives only in the RAG feature's
  `server/embedder.server.ts` (bi-encoder embeddings) and `server/reranker.server.ts` (cross-encoder
  reranker, deliberate Day-23 decision). No other non-LLM SDKs without a deliberate decision.

## Layout

- `src/features/agent/`, `src/features/rag/` — two self-contained features built for porting; each
  README (above) carries its module map.
- `src/lib/` — shared: `llm.ts`/`llm.server.ts` (transport), `functions/*.functions.ts` (Days 1–5 server
  fns + shared `validation.ts`), `day2.ts`…`day5.ts`, `days.ts` (sidebar), `utils.ts` (`cn`).
- `src/components/` — app shell (`Header`, `Sidebar`, `Chat`) and shared `ui/Tabs.tsx`.
- `src/routes/` — thin route wrappers; `/agent` → `AgentPage`, `/rag` → `RagPage`, old `/agent-*` routes
  redirect to `/agent`.

## Hard rules

- **Server & LLM**: keep the LLM transport on raw `fetch`, wrapped by the generic
  `callCompletions(endpoint, apiKey, messages, params)`. Read secrets server-side from `process.env`
  (`DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `HUGGING_FACE_TOKEN`) and keep them out of the browser bundle
  (ids only, no `VITE_` keys, no `import.meta.env`). Each `createServerFn` is a thin adapter:
  `validator → delegate` to a deep module. Server-only modules use the `.server.ts` suffix; client-safe
  prompt/text data lives in `dayN.ts` / feature `data/`.
- **The client sends ids, not content** — tier / strategy / session. Invariant CRUD is the explicit
  exception: the rule itself is user-managed data and is sent to its CRUD function.
- **Persistence**: `features/agent/server/store/db.server.ts` is the `node:sqlite` singleton; the
  `store/` folder splits storage by concept (`sessions`, `branches`, `messages`, `facts`, `memory`,
  `people`, `tasks`, `invariants`, `profiles`, `agent-records`) and imports them directly — there is no
  `store.server.ts` barrel. Import `node:sqlite` dynamically (`await import`) inside a `.server.ts`.
- **Session config is immutable**: strategy, memory, profile, window size and task state are fixed by
  `createSession` and read by `runAgentTurn`; a different config means a new session.
- **Invariants are global per token** and enforced deterministically before mutating tools and after
  finalize; the opt-in `invariantGuard` is a fallback, never a replacement. Pinned `slug`/`check` are
  immutable.
- **MCP tools**: `agent-mcp-demo` is read-only; `agent-mcp-jobs` writes its own `jobs.sqlite`. Tool
  metadata travels over the protocol: each spawned server sets `annotations: { readOnlyHint }`, the host
  derives `descriptor.mutating` (`readOnlyHint !== true` → mutating, fail-closed) and mutating MCP tools
  obey the same task-stage gate as internal mutations; reference MCP tools stay available in every stage.
  Never reintroduce a host-side hardcoded list of MCP tool names. Discovery/listing degrades per
  server (a dead server removes only its tools). The MCP SDK reaches neither the LLM transport nor the
  browser. MCP servers ship as compiled `.mjs` (`npm run build:mcp`), resolved by
  `server/mcp-registry.server.ts` via `AGENT_MCP_DEMO_ENTRY`/`AGENT_MCP_JOBS_ENTRY` → `dist` → dev source.
- **Conventions**: write no comments unless asked. Extract a decision into a small named function with
  early returns instead of nested ternaries or long `if/else if` ladders. Respond one chunk at a time
  (no streaming yet; the UI shows a 3-dots animation). Tests live in `src/**/*.test.ts` (Vitest, node
  env; the agent testkit is an in-memory `AgentStore`, the RAG testkit is an in-memory corpus + a
  deterministic hash embedder). Prefer offline tests through injection (e.g. `WeatherSource`,
  `CorpusSource`, temp sqlite); real-network tests run under `RUN_NETWORK_TESTS=1` and real local-model
  tests under `RUN_MODEL_TESTS=1`. Out of scope: streaming, a real auth/backend for `people` (a seeded
  mock today). Work on `feature/dayN` branches; commit only when asked. Deployment lives in `deploy/`
  (systemd + timer, Tailscale-only). Tracked docs live in `docs/` (decisions in `docs/adr/`); working
  plans go in gitignored `md/`.

## Commands

All scripts live in `package.json`. The non-obvious ones:

```bash
npm run typecheck       # tsc --noEmit
npm run generate-routes # regenerate src/routeTree.gen.ts after adding/renaming routes
RUN_NETWORK_TESTS=1 RUN_MODEL_TESTS=1 npm run test  # unlock gated network/model tests
```
