# Project: AI Advent Challenge

Daily AI-learning steps. Each day is a branch `feature/dayN`; current work: Day 33 (`feature/day33`).
Days 13–20 extend the unified `/agent` (task state, invariants, MCP); Days 21–25 build `/rag` and make it an
agent capability. Days 26–30 add local-MLX features: the `/local-llm` tab, a Telegram quiz bot, a local RAG
generator, the `/llm-opt` lab, and the private `llm-service` gateway published over Tailscale Funnel. Day 31
adds the developer assistant (`/dev-assistant`): RAG over the project's own docs plus git over MCP. Day 32
turns the same engine into an automated pull-request review pipeline (GitHub Action + headless CLI). Day 34
makes `/dev-assistant` a file assistant: a shared tool loop / task FSM / invariants engine in `@lib`, a
sandboxed file MCP server, and a plan → approve → execute → auto-validate flow with a printed diff. Day 35
adds `auto-review`: a reviewer console that installs an uploaded student project, judges it with a
Playwright suite plus static rules and the model, and reports per-criterion verdicts. Day 33
adds the unofficial Ozon support assistant (`/support`): RAG over the Ozon docs mirror, seller/ticket
context over MCP, and a public Funnel instance limited to `/support`.

## Where to read more

- `src/features/agent/README.md` — mechanics of the agent feature: turn execution, tools, task state
  machine, invariants, context strategies, memory, profile, persistence, MCP and the RAG capability,
  plus porting notes. Read it before editing any of those.
- `src/features/rag/README.md` — document indexing: corpus source, chunking strategies, embeddings,
  SQLite index, retrieval, reranking/threshold + query rewrite, the mode comparison, and local
  generation (Day 28). Read it before editing any of those.
- `src/features/telegram-quiz/README.md` — the Telegram quiz bot: module map, round flow, run and
  porting notes. Read it before editing the bot.
- `src/features/llm-opt/README.md` — the local-LLM optimization lab: task profile, sweep configs, metric,
  results persistence and the quantization procedure. Read it before editing the lab.
- `src/features/llm-service/README.md` — the private LLM service: gateway module map, API/limits, run and
  publish (Tailscale Funnel) instructions, and the stability probe. Read it before editing the service.
- `src/features/dev-assistant/README.md` — the developer assistant (Day 31), the PR review pipeline
  (Day 32) and the file assistant (Day 34): project corpus, markdown/code chunkers, cosine retrieval, the
  git/files MCP servers, `/help`, the diff reader, the review contract and the GitHub delivery, plus the
  file-task orchestration and its invariants. Read it before editing it or the shared RAG engine / MCP
  host / agent loop in `src/lib`.
- `src/features/support-assistant/README.md` — the unofficial Ozon support assistant (Day 33): corpus
  fetch and index, the seven-tool Ozon MCP server, ticket context, the abstention contract, public
  allowlist/limits, and the two-instance Funnel deploy. Read it before editing `/support` or the shared
  markdown chunker.
- `CODING_STANDARDS.md` — style, test and product-scope rules to apply when writing or reviewing code.
- `GLOSSARY.md` — domain vocabulary (Ход, Задача, Этап, Инвариант, …).
- `README.md` — day-by-day log of the challenge.

## Language

- **Always answer the user in Russian.** All chat replies, plans, summaries and commit messages the user
  reads must be in Russian. Code, identifiers and file paths stay in English.
- **Never write comments in code.** No explanatory comments, no section banners, no "why" notes, no JSDoc
  blocks — in new files, in edited files, in tests. Comments are written only when the user explicitly asks
  for them in that message. Rationale and decisions belong in the feature README or an ADR, not in the
  source. Do not add comments "for consistency" with the surrounding code, and do not touch existing
  comments unless the user asks.

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
- `src/features/llm-opt/` — standalone `/llm-opt` optimization lab: OFAT sweep of prompt/params/context on
  a fact-extraction task plus quantization comparison; dev/local-only, reaches the model through
  `@lib/local-llm.server` (module map in the feature README).
- `src/features/llm-service/` — standalone private LLM service (Day 30): a Node HTTP gateway in front of
  the local MLX model with an OpenAI-compatible API, a chat page and limits; published via Tailscale
  Funnel. Bundled with esbuild, outside `vite build` (module map in the feature README).
- `src/features/support-assistant/` — standalone unofficial Ozon support assistant (Day 33) on `/support`:
  a private markdown `support` index over the Ozon docs mirror, a seven-tool read-only Ozon MCP server over
  fixtures, seller/ticket context, three-block answers and a public Funnel instance limited by an
  allowlist (`SUPPORT_PUBLIC=1`). Imports only `@lib`; module map in the feature README and ADR-0019.
- `src/features/dev-assistant/` — standalone assistant (Day 31) that answers about the project: its own
  markdown corpus read from disk, the shared `@lib/chunking/markdown.server` factory (id `markdown`), its
  own SQLite index, and a read-only git MCP server. Day 32 adds a headless pull-request review pipeline in
  the same feature (`cli/review.ts` + `.github/workflows/pr-review.yml`) that indexes docs **and code**
  under a private `review` strategy. Day 34 adds the file assistant (`mcp/files/*`,
  `server/file-task.server.ts`, `cli/file-assistant.ts`) with its own `node:sqlite` runs DB, plus
  docs-vs-files routing on the same page. It imports only `@lib` (never `features/rag` or
  `features/agent`); module map in the feature README.
- `src/features/auto-review/` — standalone reviewer console (Day 35) over `/auto-review`: uploads a zip of
  a student project, installs and serves it, judges it with a Playwright suite (Chromium + Firefox) plus
  static Д-rules and DeepSeek for the rest, and stores every review in its own `node:sqlite`
  (`auto-review.sqlite`). Imports only `@lib`; its Playwright specs live under `e2e/` (excluded from
  Vitest) and run from the challenge, not from the reviewed project. Module map in the feature README.
- `src/lib/` — shared: `llm.ts`/`llm.server.ts` (transport), `agent-rag.server.ts` (agent↔RAG
  composition), `rag-engine.{types,server}.ts` (app-level RAG engine facade: index → `searchSources` →
  `answerFromSources`), `chunking/markdown.server.ts` (the shared markdown chunker factory used by
  dev-assistant, PR review and support), `source-format.ts` (numbered Источники), `mcp/**` (shared MCP host, generic
  context collector, server helpers, neutral MCP→Tool adapter), `agent-loop/**` (the tool loop:
  `Tool.run(args, ctx)`, `$ref`, repeat guard, `maxActions`, pause hook, and the `LoopHooks` seam),
  `task-state/**` (FSM mechanics, textual gates, analyzer factory, block/line formatting),
  `invariants/**` (engine over a per-consumer rule registry, block rendering, LLM guard; the loop is
  covered by its own `agent-loop/loop.test.ts` over a scripted `CallLLM`),
  `functions/*.functions.ts`
  (Days 1–5 server fns + shared `validation.ts`), `day2.ts`…`day5.ts`, `days.ts` (sidebar), `utils.ts` (`cn`).
  **`src/lib` composes features, it does not depend on one**: only the app-level composition modules
  (`agent-rag.server.ts`, `rag-engine.{server,types}.ts`) import `features/*`; every other `lib` module
  (transport, `mcp/**`, `source-format.ts`) stays feature-agnostic and never reaches into a feature's
  private registry.
- `src/components/` — app shell (`Header`, `Sidebar`, `Chat`), shared `ui/*`, and the shared
  `TaskStateBar` + `TraceAccordion`/`TraceStepBlock`/`StepBody` over `@lib` types (used by both the agent
  page and the file assistant).
- `src/routes/` — thin route wrappers; `/agent` → `AgentPage`, `/rag` → `RagPage`, `/local-llm` →
  `LocalLlmPage`, `/llm-opt` → `LlmOptPage`, `/dev-assistant` → `DevAssistantPage`; old `/agent-*` routes
  redirect to `/agent`.

## Hard rules

- **Server & LLM**: keep the LLM transport on raw `fetch`, wrapped by the generic
  `callCompletions(endpoint, apiKey, messages, params)` (with a streaming `streamCompletions` sibling in
  the same module for SSE). Read secrets server-side from `process.env`
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
- **Local LLM (Day 26)**: `features/local-llm/` is a dev/local-only `/local-llm` tab over the MLX endpoint
  (`LOCAL_LLM_BASE_URL`/`LOCAL_LLM_MODEL`, no key), reached through `callCompletions` (Qwen3 needs
  `chat_template_kwargs.enable_thinking=false` via `extraBody`); a down server degrades via `/models`.
- **Telegram quiz (Day 27)**: `features/telegram-quiz/` is a dev/local-only grammY bot (long polling,
  esbuild `.mjs`, `npm run bot`) that never goes through `features/local-llm` or the agent; the quiz model
  is `QUIZ_LLM_MODEL` (fallback `LOCAL_LLM_MODEL`). Module map and generation rules: feature README.
- **Local RAG generation (Day 28)**: inside `features/rag`, the answer `generator` is selectable
  (`cloud` | `local`, default `cloud`); the local adapter uses `RAG_LLM_MODEL` and reaches the model only
  through `@lib/local-llm.server`, with contract/abstention identical to the cloud path. See the RAG README.
- **Local LLM optimization lab (Day 29)**: `features/llm-opt/` is a dev/local-only OFAT lab over a
  fact-extraction task, reaching the model only through `@lib/local-llm.server`; the client sends config
  ids and results accumulate on disk. See the feature README.
- **Private LLM service (Day 30)**: `features/llm-service/` is a standalone Node HTTP gateway over the
  local MLX model (OpenAI-compatible API + chat page), bundled with esbuild outside `vite build` and
  published via Tailscale Funnel; it reaches the model only through `@lib/local-llm.server`, gates with
  `LLM_SERVICE_KEYS`, and enforces rate limit / max context / a single-flight queue in-process. Relaxes the
  local-llm dev-only and no-streaming rules — see the feature README and ADR-0008.
- **Support assistant (Day 33)**: `features/support-assistant/` is the unofficial Ozon seller helper on
  `/support`. It owns a private `support` SQLite index over the Ozon docs mirror (`fetch:ozon-corpus` →
  `support:index`; `kind: section` pages are skipped, `updated` goes into the chunk title), a read-only
  stdio MCP server `support-mcp-ozon` with seven tools (`get_seller`, `list_tickets`, `get_ticket`,
  `list_postings`, `get_posting`, `get_product`, `get_finance`) over synthetic fixtures with masked API
  keys, and the ask flow `MCP → ticket context → searchSources → answerFromSources`. One MCP session per
  request; the context is capped at 6000 characters. `contextRescues: false`: ticket context never turns
  a weak retrieval into an answer, so off-topic questions abstain. The page and the API are real server
  routes (`/support`, `/api/support/{sellers,ask,health}`), not `createServerFn`, so the public second
  instance can allowlist them: `SUPPORT_PUBLIC=1` returns 404 for everything else. The private instance
  stays on `serve --https=8443`; the public one is `funnel --https=443` on port 3001. Limits: 30/hour per
  IP (only `X-Forwarded-For`; `X-Real-IP` is attacker-controlled), 60/hour globally, 200/day, single-flight
  queue 2, 4 KB body, 800-char question, 45 s through the transport `AbortSignal`. The answer is rendered
  by `react-markdown` without raw HTML. See the feature README and ADR-0019.
- **Developer assistant (Day 31)**: `features/dev-assistant/` is a dev/local-only `/dev-assistant` page that
  answers about the project itself. It reuses RAG through `src/lib/rag-engine.server.ts` (the
  `searchSources` / `answerFromSources` seams over `features/rag`, which it never imports) and git through
  a read-only MCP server (`dev-assistant-mcp-git`: branch/status/log/changed files/diff) reached via
  `src/lib/mcp`. Corpus is read from disk (`data/corpus-manifest.ts`), chunked by the shared
  `@lib/chunking/markdown.server` factory (id `markdown`, unregistered), stored in its own SQLite; the git context
  is collected by the feature (`server/git-context.server.ts`) over the generic
  `@lib/mcp/context.server`; the headless core `answerAboutProject({ question, store, generator,
  contextBlocks })` takes plain `contextBlocks` (git today, the PR diff on Day 32) and reuses the RAG JSON
  contract/quote verification. `/help` is the one real command. See the feature README, ADR-0009,
  ADR-0010 and ADR-0011.
- **File assistant (Day 34)**: `features/dev-assistant` gains a third mode. Page input and the CLI route
  through `domain/file-router.ts`: no file intent → the Day-31 RAG answer; read/search → a read-only loop
  with no Задача; write → a persisted `planning` task, then `approveFileTask` runs
  execution → validation → done in one server call with at most one retry. The run itself is one module
  (`server/file-run.server.ts`: phase allowlists, budgets, touched paths, `runPlan` — one execution phase
  per plan step, so every step is attempted and only the steps whose paths stayed untouched are retried);
  `server/file-task.server.ts` keeps routing, the task and persistence. Tools come from
  `dev-assistant-mcp-files` (`list_files`, `read_file`, `search_text` read-only; `write_file`, `edit_file`
  mutating) with a sandbox root `DEV_ASSISTANT_REPO_DIR` (git falls back to `GIT_REPO_DIR`) and one
  protected set — `.git`, `.github`, `node_modules`, `dist`, `.env*`, `*.sqlite`, declared in
  `domain/protected-paths.ts` and shared by the sandbox and the invariant — on reads and writes;
  `edit_file` needs a unique `oldString` unless `replaceAll`. Planned paths and file mentions are one
  module too (`domain/file-paths.ts`: routing, `extractPlanPaths`, `matchesPlannedPath`), so the write
  gate and the retry decision cannot drift. Only touched paths are diffed (git MCP — an untracked file is
  diffed with `git diff --no-index /dev/null` so a newly created file still shows up), and the diff is
  highlighted in `components/DiffBlock.tsx` — client-only `shiki` (fine-grained bundle, `lang: diff`, dual
  light/dark themes) rendered from tokens, never `dangerouslySetInnerHTML`; the same page shows the whole
  plan, not just the current step, through the shared `components/TaskStateBar.tsx`. A run carries the
  result of the finished steps into the next phase as a "what is already done" system block, escalates a
  step whose planned paths stayed untouched (and reports it as `unfinished`), and reports `notChanged` when
  a write task produced no edits at all — so a plan can neither stop silently after its first step nor be
  presented as done. Pinned file
  invariants (planned paths only, no secrets in contents, protected paths) are seeded into the feature's
  own `node:sqlite` DB (`DEV_ASSISTANT_RUNS_DB_PATH`, `dev-assistant-runs.sqlite`) and enforced through
  `@lib/invariants`. Two goals skip the model and answer from the repository: a repo-state goal
  (`looksLikeRepoStateGoal`) returns `collectRepoChanges` (`server/repo-diff.server.ts`, git MCP:
  `git_changed_files` + per-file `git_diff`), and an invariant-check goal (`looksLikeInvariantCheckGoal`)
  reports violations from `domain/invariant-report.ts` over the changed files read through the files MCP
  (`server/repo-check.server.ts`), reusing the very `containsSecret`/`isProtectedPath` predicates the write
  gate uses. The loop, task FSM, invariants engine and the MCP→Tool adapter live in `@lib`
  (`agent-loop`, `task-state`, `invariants`, `mcp/tools.ts`); the agent keeps its prompts, judges and
  registries and delegates to the same loop, behaviour-preserving. Tool reports are capped by
  `buildMcpTools(..., { maxChars })` (default `MCP_TOOL_REPORT_MAX_CHARS`, the file feature raises it so a
  full file fits) and a truncated report says how much was cut and how to narrow the window; the loop's
  repeat guard is opt-in feedback (`policy.onRepeat`) rather than a silent break. Every run — goal, plan,
  trace and answer — is stored in the runs DB, and the trace keeps each decision's `raw` model reply, which
  is the feature's debugging channel. `FILE_ASSISTANT_GENERATOR=local` swaps
  in the local model. The feature owns `node:sqlite` here (its own runs DB), not through `features/rag`.
  See the feature README, ADR-0014, ADR-0015, ADR-0016 and ADR-0017.
- **PR review pipeline (Day 32)**: `.github/workflows/pr-review.yml` runs the headless
  `features/dev-assistant/cli/review.ts` on PRs (draft skipped) and on `workflow_dispatch` with a `pr`
  input. It reads the diff from `git diff base...head` (`server/pr-diff.server.ts`, three-dot, size-capped)
  rather than the git MCP (`git_diff` caps at 1000 lines), indexes docs + code into the private `review`
  strategy of the feature's SQLite (`server/review-index.server.ts`, never the chat's `markdown` index),
  and calls `reviewPullRequest` (`server/review.server.ts`) — the sibling of `answerAboutProject`, sharing
  `searchSources`/`buildSourceMessages`/`resolveAnswerLlm` but with `REVIEW_PERSONA` and the
  `{summary, findings}` contract. Stage two is the judge (`server/review-judge.server.ts`): it reuses the
  same chunks and asks for `{verdicts}` to keep or drop each finding, never rewriting them, failing open
  (`PR_REVIEW_JUDGE=0` disables it; rejected findings stay in a collapsed block). Findings become inline
  RIGHT comments only when path+line pass anchor validation (`domain/review-report.ts`); the rest go to one
  sticky `<!-- ai-pr-review -->` issue comment, with previous bot inline comments deleted and re-posted
  (`server/github.server.ts`). Generation defaults to cloud (`PR_REVIEW_GENERATOR=local` swaps in the
  Funnel); a failure posts a note and exits green — never blocks a PR. The CLI runs under plain Node via
  `scripts/mcp-alias-loader.mjs`, so nothing on its import graph may use Vite-only APIs at module top
  level. See the feature README, ADR-0012 and ADR-0013.
- **Auto-review (Day 35)**: `features/auto-review/` is a dev/local-only `/auto-review` console that
  reviews an uploaded student project («Шесть городов»). Verdicts are deterministic first: Б1/Б2/Б3 come
  only from a Playwright run of the TЗ suite in Chromium + Firefox, seven Д rules are static
  (`domain/code-checks.ts`), and DeepSeek only judges the remaining Д and writes the human reasons — it
  never flips a pass/fail for the basic criteria. The suite lives in the feature (`e2e/`, excluded from
  Vitest), runs from the challenge with `baseURL` = the reviewed dev server, and answers
  `*.design.htmlacademy.pro/six-cities/**` from fixtures while aborting every other origin. The project is
  extracted and served locally, so install failures, a dead dev server or a missing report degrade to
  `not_checked` with the cause, never to a silent pass; code criteria still run on whatever was extracted.
  The flow is `@lib/task-state` (`planning` → approve → `execution` → `validation` → `done`) with two
  parallel tracks (Playwright vs sources), a detached in-process run whose progress is polled from `runs`,
  and its own `node:sqlite` (`auto-review.sqlite`). A re-review carries `resumedFrom`, is planned and
  judged only for the previously failed codes, and carries the rest over. The source is a zip **or** an
  already-extracted folder (UI switch, `--dir` in the CLI); the external folder is never deleted by
  cleanup, only the challenge-owned copies are. A run can be interrupted: an `AbortController` kills the
  child process group (install, dev server, Playwright), the task moves to `cancelled` and the review
  status becomes `cancelled` (the partial report is not presented as a verdict). Clearing sources from
  the UI keeps history unless asked otherwise. See the feature README, ADR-0018.
- **MCP tools**: `agent-mcp-demo` is read-only; `agent-mcp-jobs` writes its own `jobs.sqlite`. Tool
  metadata travels over the protocol: each spawned server sets `annotations: { readOnlyHint }`, the host
  derives `descriptor.mutating` (`readOnlyHint !== true` → mutating, fail-closed) and mutating MCP tools
  obey the same task-stage gate as internal mutations; reference MCP tools stay available in every stage.
  Never reintroduce a host-side hardcoded list of MCP tool names. Discovery/listing degrades per
  server (a dead server removes only its tools). A consumer whose loop calls tools many times per run
  opens **one session per server per run** (`openMcpSession` in `client.server.ts`, wrapped by
  `openDevAssistantTools`) and closes it when the run ends; `callToolOn`/`callToolsFor` stay for the
  occasional call. The MCP SDK reaches neither the LLM transport nor the
  browser. **The host machinery lives in `src/lib/mcp/`** (`client.server.ts`, `registry.server.ts`,
  `types.ts`, `serve.ts`, `response.ts`); each feature declares its own `McpServerSpec` list
  (`features/agent/server/mcp-registry.server.ts`, `features/dev-assistant/server/mcp-registry.server.ts`).
  Spec paths (`compiledFile`, `sourcePath`) resolve from one anchor — `process.cwd()`. Tools may declare
  `outputSchema` and return `structuredContent`; the host surfaces it as `McpCallResult.structured` and
  falls back to text, so consumers never parse another server's prose. Agent consumers bind the host to
  their registry themselves (`server/mcp-tools.server.ts`); there is no per-feature pass-through module.
  MCP servers ship as compiled `.mjs` (`npm run build:mcp`), resolved via `AGENT_MCP_*_ENTRY` /
  `DEV_ASSISTANT_MCP_GIT_ENTRY` → `dist` → dev source. Sources are `.ts` executed by Node, which ignores
  tsconfig paths, so `scripts/mcp-alias-loader.mjs` (`--import`, `.ts` entries only) and an esbuild `alias`
  in `scripts/build-mcp.mjs` provide `@/`/`@lib/` + extensionless resolution at runtime and at build time.
- **Workflow**: work on `feature/dayN` branches; commit only when asked. Deployment lives in `deploy/`
  (systemd + timer, Tailscale-only; the Day-30 private service adds a `launchd` example and is published
  through Tailscale Funnel; Day 33 adds the second `ai-advent-support.service` on 3001 with a public
  Funnel only for `/support`, while the main app moves to `serve --https=8443`). Tracked docs live in
  `docs/` (decisions in `docs/adr/`); working plans go in gitignored `md/`.

## Commands

All scripts live in `package.json`. The non-obvious ones:

```bash
npm run typecheck       # tsc --noEmit
npm run generate-routes # regenerate src/routeTree.gen.ts after adding/renaming routes
npm run bot             # build + run the Telegram quiz bot (needs TELEGRAM_BOT_TOKEN + local MLX)
npm run build:llm-service   # bundle the private LLM service (esbuild → dist/server/llm-service/)
npm run llm-service         # build + run the private LLM service (needs local MLX + LLM_SERVICE_KEYS)
npm run llm-service:load    # stability probe against a running service
npm run review:pr           # run the PR review pipeline (PR_BASE_SHA=… PR_REVIEW_DRY_RUN=1 for a dry run)
npm run auto-review -- --zip <path> [--key <key>]   # авторевью студенческого проекта (ключ — из имени архива; --resume <id> — только проваленные пункты)
npm run auto-review -- --dir <path> [--key <key>]   # то же для уже распакованного проекта (папку не удаляем)
npm run playwright:install  # браузеры набора авторевью (Chromium + Firefox)
npm run file-assistant -- --scenario find-usages   # file assistant CLI (--apply writes; default plan-only)
npm run file-assistant -- --goal "…" --apply
npm run fetch:ozon-corpus   # скачать зеркало документации Ozon в .cache/ozon-corpus
npm run support:index       # собрать support.sqlite (локально, затем деплой копирует его)
RUN_NETWORK_TESTS=1 RUN_MODEL_TESTS=1 npm run test  # unlock gated network/model tests
```

TypeScript is split by alias on purpose: `typescript` → `@typescript/typescript6` (JS API 6.0, bin
`tsc6`), `@typescript/native` → `typescript@7` (bin `tsc`, no programmatic API in 7.0), so `typecheck`
runs the native compiler while a future API consumer still gets 6.0. If `npm install` ever re-pins
`node_modules/typescript` to the plain 6.x package, restore the alias entry in the lockfile by hand — npm
does not re-resolve it after the switch.
