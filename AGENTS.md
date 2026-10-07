# Project: AI Advent Challenge

Daily AI-learning steps. Each day is a branch `feature/dayN`; current work: Day 27 (`feature/day27`).
Days 13–20 extend the unified `/agent` workspace with task state, invariants and MCP; Day 21 adds the
`/rag` document-index feature; Day 22 adds RAG answers with/without retrieval and a control set; Day 23
adds a second retrieval stage (cross-encoder reranking + relevance threshold) and query rewrite; Day 24
makes the answer contract structured (mandatory sources + verified quotes) and adds threshold abstention;
Day 25 makes RAG a capability of the unified `/agent` — always-on retrieval with sources, a `rag_search`
tool and a dialogue task memory in `MemoryEntry`, composed at the app level (no `agent → rag` import);
Day 26 adds a standalone `/local-llm` feature that runs Qwen3-8B-4bit locally on Apple Silicon via MLX
and proxies it through the shared `callCompletions` (three difficulty presets + freeform, latency/tokens
metrics, graceful degrade when the local server is down). Day 27 adds a separate Telegram quiz bot
(`features/telegram-quiz`, grammY + long polling, esbuild bundle) that generates MC questions with that
local model — no cloud models, only `api.telegram.org` outbound.

## Where to read more

- `src/features/agent/README.md` — mechanics of the agent feature: turn execution, tools, task state
  machine, invariants, context strategies, memory, profile, persistence, MCP and the RAG capability,
  plus porting notes. Read it before editing any of those.
- `src/features/rag/README.md` — document indexing: corpus source, chunking strategies, embeddings,
  SQLite index, retrieval, reranking/threshold + query rewrite, and the mode comparison. Read it
  before editing any of those.
- `src/features/telegram-quiz/README.md` — the Telegram quiz bot: module map, round flow, run and
  porting notes. Read it before editing the bot.
- `CODING_STANDARDS.md` — style, test and product-scope rules to apply when writing or reviewing code.
- `GLOSSARY.md` — domain vocabulary (Ход, Задача, Этап, Инвариант, …).
- `README.md` — day-by-day log of the challenge.

## Stack

- **TanStack Start** (Vite + React 19 + TypeScript), file-based routing (`src/routes`).
- **Tailwind v4** via `@tailwindcss/vite`. Tokens/theme (`data-theme`, light/dark) in `src/styles.css`.
- Styling: bare Tailwind + semantic tokens (`.demo-*`/`.island-*` kit). Slate palette + indigo accents;
  `--positive`/`--danger` reserved for meaning. Add a component library only when asked.
- **SDKs**: keep the LLM transport on raw `fetch`; `@modelcontextprotocol/sdk` + `zod` live only in the
  MCP server/client modules; `@huggingface/transformers` (local ONNX) lives only in the RAG feature's
  `server/embedder.server.ts` (bi-encoder embeddings) and `server/reranker.server.ts` (cross-encoder
  reranker, deliberate Day-23 decision); `grammy` lives only in `features/telegram-quiz` (deliberate
  Day-27 decision). No other non-LLM SDKs without a deliberate decision.

## Layout

- `src/features/agent/`, `src/features/rag/` — self-contained features built for porting; each README
  (above) carries its module map. They do **not** import each other: the app-level composition module
  `src/lib/agent-rag.server.ts` wires `features/rag` into the agent's capability registry, bootstrapped
  by the server entry `src/server.ts`.
- `src/features/local-llm/` — standalone `/local-llm` tab: local MLX model proxied through
  `callCompletions`; dev/local-only, independent of the agent (module map below in Hard rules).
- `src/features/telegram-quiz/` — standalone Telegram quiz bot on the same local model (grammY + long
  polling, esbuild bundle); dev/local-only, with its own module map in the feature README.
- `src/lib/` — shared: `llm.ts`/`llm.server.ts` (transport), `agent-rag.server.ts` (app composition),
  `functions/*.functions.ts` (Days 1–5 server fns + shared `validation.ts`), `day2.ts`…`day5.ts`,
  `days.ts` (sidebar), `utils.ts` (`cn`).
- `src/components/` — app shell (`Header`, `Sidebar`, `Chat`) and shared `ui/Tabs.tsx`.
- `src/routes/` — thin route wrappers; `/agent` → `AgentPage`, `/rag` → `RagPage`, `/local-llm` →
  `LocalLlmPage`, old `/agent-*` routes redirect to `/agent`.

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
- **Session config is immutable**: strategy, memory, profile, window size, task state and `ragEnabled`
  are fixed by `createSession` and read by `runAgentTurn`; a different config means a new session.
- **RAG is an agent capability, composed at the app level**: the agent owns a RAG-agnostic capability
  seam (`domain/capabilities/`, `server/capability-registry.server.ts`) and `executeAgent` only accepts
  generic `extraBlocks`/`extraTools`. `src/lib/agent-rag.server.ts` adapts `features/rag` and registers
  the capability; `src/server.ts` bootstraps it. `features/agent` never imports `features/rag`, and
  `features/rag` never imports `features/agent` (same rule for `@huggingface/transformers`/`node:sqlite`:
  stay inside `features/rag/server`). When `ragEnabled`, retrieval runs every turn, the `rag_search`
  read-only tool joins the loop, and `sources`/`grounding`/`citations` land in `AgentRunResult`;
  off-topic/no-index degrades softly to `no-data`.
- **Invariants are global per token** and enforced deterministically before mutating tools and after
  finalize; the opt-in `invariantGuard` is a fallback, never a replacement. Pinned `slug`/`check` are
  immutable.
- **Local LLM (Day 26)** lives in `features/local-llm/` and is **dev/local-only** (the Mac running MLX),
  unrelated to the agent. It reuses `callCompletions` against an OpenAI-compatible endpoint from
  `LOCAL_LLM_BASE_URL`/`LOCAL_LLM_MODEL` (no key). Qwen3 needs `chat_template_kwargs: { enable_thinking:
  false }`, passed via the transport's generic `CallCompletionsOptions.extraBody`. The client sends a
  `presetId` (resolved server-side from `data/presets.ts`) or freeform `prompt`; a down server degrades
  softly via a `/models` health check.
- **Telegram quiz (Day 27)** lives in `features/telegram-quiz/` and is **dev/local-only**, independent
  of the agent and the web app. It uses `grammy` (deliberate non-LLM SDK) with long polling
  (`bot.start()`), an in-memory `RoundStore` (no `@grammyjs/sessions`; `ctx` stays out of the domain) and
  no streaming — a question is JSON, rendered only when complete. It reaches the local model through the
  shared `@lib/local-llm.server` (`runLocalChat`, `getLocalLlmStatus`), never via `features/local-llm`
  or the agent. Questions are generated with a strict-JSON prompt (which deliberately omits the
  already-asked list — at low temperature it makes the model echo the forbidden question); the parser
  extracts the first balanced `{…}` and the generator regenerates on invalid JSON, a repeated question,
  identical options (a degenerate MC) **or non-Cyrillic/Latin characters** (CJK leakage), at
  `GENERATOR_TEMPERATURE`. The quiz model comes from
  `QUIZ_LLM_MODEL` (falls back to `LOCAL_LLM_MODEL`), so it can differ from `/local-llm`. State is per
  chat/round, gated by a round id and
  the round phase. The bot ships as a compiled `.mjs` (`npm run build:bot` → `dist/server/bot/`), run via
  `npm run bot`; both it and `features/local-llm` stay out of `vite build`.
- **MCP tools**: `agent-mcp-demo` is read-only; `agent-mcp-jobs` writes its own `jobs.sqlite`. Tool
  metadata travels over the protocol: each spawned server sets `annotations: { readOnlyHint }`, the host
  derives `descriptor.mutating` (`readOnlyHint !== true` → mutating, fail-closed) and mutating MCP tools
  obey the same task-stage gate as internal mutations; reference MCP tools stay available in every stage.
  Never reintroduce a host-side hardcoded list of MCP tool names. Discovery/listing degrades per
  server (a dead server removes only its tools). The MCP SDK reaches neither the LLM transport nor the
  browser. MCP servers ship as compiled `.mjs` (`npm run build:mcp`), resolved by
  `server/mcp-registry.server.ts` via `AGENT_MCP_DEMO_ENTRY`/`AGENT_MCP_JOBS_ENTRY` → `dist` → dev source.
- **Workflow**: work on `feature/dayN` branches; commit only when asked. Deployment lives in `deploy/`
  (systemd + timer, Tailscale-only). Tracked docs live in `docs/` (decisions in `docs/adr/`); working
  plans go in gitignored `md/`.

## Commands

All scripts live in `package.json`. The non-obvious ones:

```bash
npm run typecheck       # tsc --noEmit
npm run generate-routes # regenerate src/routeTree.gen.ts after adding/renaming routes
npm run bot             # build + run the Telegram quiz bot (needs TELEGRAM_BOT_TOKEN + local MLX)
RUN_NETWORK_TESTS=1 RUN_MODEL_TESTS=1 npm run test  # unlock gated network/model tests
```
