# ADR-0014: shared agent engines in `lib` and the Day-34 file assistant

- Status: accepted
- Date: 2026-10-16
- Area: `src/lib/{agent-loop,task-state,invariants,mcp}`, `src/components/{TaskStateBar,Trace*}`,
  `src/features/agent/{domain,server}`, `src/features/dev-assistant/{mcp/files,domain,server,cli,components}`
- Related: ADR-0002 (agent store split), ADR-0010 (MCP host in `lib`), ADR-0011 (deep seams),
  ADR-0012 (PR review pipeline)

## Context

Day 34 turns `/dev-assistant` from "question → answer over docs" into an assistant that works with the
project's files: it searches across several files, analyses them, creates and edits files, and then
verifies the result with read-only tools. The task requires at least two reproducible scenarios, real
writes (or a printed diff) and a plan → approve → execute flow.

That work needs three things the corporate agent already has, but which lived inside
`features/agent/domain`:

1. the **tool loop** (decide → act → observe → finalize, `$ref` between tool outputs, repeat guard,
   `maxActions`, pause hook) — ~750 lines entangled with agent policy (roles, rooms, corporate tool hints,
   judges, invariant checks, stage gate);
2. the **task FSM** (`planning / execution / validation / done / paused / cancelled` plus step plans and
   the textual consent gates);
3. the **invariants engine** (deterministic action/answer checks, the LLM guard for checkless rules).

Copying any of them into `features/dev-assistant` would contradict the repo rule that a feature never
imports another feature, and would leave two divergent implementations of the same mechanics. Two more
constraints shaped the decision:

- the file assistant must also enforce invariants (write only planned paths, no secrets in files, no
  protected paths), so the checks engine cannot stay agent-private;
- the agent must keep working unchanged: its tests (`agent.test.ts`, `agent-turn.test.ts`,
  `invariants-agent.test.ts`, `task-*.test.ts`, `mcp-*`) are the fence for the refactor.

## Decision

1. **Extract the mechanics into `src/lib`, keep the policy in the feature.**
   - `src/lib/agent-loop/` — `types.ts` (`Tool<TContext>` with `run(args, ctx)` / `screenArgs` /
     `mutating`, LLM plumbing, `LoopTraceStep`, `LoopRunResult`, `LoopHooks`, `LoopConfig`),
     `loop.ts` (`runToolLoop`), `prompt.ts` (reusable catalogs/lines only), `tokens.ts` (estimators).
   - `src/lib/task-state/` — `types.ts`, `state.ts`, `gates.ts` (text consent/correction heuristics),
     `advance.ts`, `analyze.ts` (`parseTaskAnalysis` + `createAnalyzer`), `read.ts` (block/line
     formatting with overridable stage notes).
   - `src/lib/invariants/` — `types.ts` (check id is an open string), `checks.ts` (engine over a
     per-consumer `InvariantRule[]` registry), `read.ts`, `guard.ts`.
   - `src/lib/mcp/tools.ts` (+ `args-example.ts`) — `buildMcpTools(descriptors, call, { prefix, label })`
     producing `agent-loop` `Tool`s, so both features share the MCP → tool adapter.

2. **The loop knows nothing about the domain.** Everything policy-shaped is a hook the consumer fills:
   `systemMessages`, `decideUser`, `finalizeUser`, `decideParams`/`finalizeParams`, `gate`, `nudge`,
   `checkAction`/`checkAnswer`, `guard`, `judges`, `onBlocked`, `cost`, `isPaused`. The agent passes its
   prompts, hints, rooms, judges and invariant rules through those hooks; the file assistant passes its
   persona, plan-paths rule set and phase budgets (6000 tokens on the mutating phase, so a file body fits
   the decide JSON).

3. **`Agent` stays the adapter.** `features/agent/domain/agent.ts` keeps its exported names
   (`AgentRunResult`, `AgentTraceStep`, `AgentTool`, `AGENT_JUDGES`, …) and delegates to `runToolLoop`;
   trace stage names and `invariantHits` are unchanged, so UI and tests did not move. Feature modules
   `domain/task/*`, `domain/invariants/*`, `domain/mcp/agent-tools.ts` become thin delegators.

4. **New MCP server `dev-assistant-mcp-files`** (`features/dev-assistant/mcp/files/*`) with `list_files`,
   `read_file`, `search_text` (ripgrep, gitignore-aware) as read-only and `write_file`, `edit_file` as
   mutating (no `readOnlyHint`, `edit_file` requires a unique match unless `replaceAll`). The sandbox
   rejects absolute paths, escapes above the root and the denylist (`.git`, `node_modules`, `dist`,
   `.env*`, `*.sqlite`) on both reads and writes. Files and git share one root:
   `DEV_ASSISTANT_REPO_DIR` (git still falls back to `GIT_REPO_DIR`).

5. **Two-phase file task with automatic validation.** `runFileGoal` routes deterministically
   (`looksLikeFileTask`): a non-file question returns `{kind:'docs'}` and the page answers it through the
   existing RAG path; a read/search goal runs a read-only loop without a task; a write goal stores a
   `planning` `TaskState`. `approveFileTask` then runs execution → validation → done inside one server
   call: the validation config only exposes read-only tools, and a mismatch (a planned path not touched,
   or no successful read-only verification) triggers exactly one retry.

6. **The feature owns its own SQLite** (`server/db.server.ts`, `node:sqlite`, file
   `dev-assistant-runs.sqlite` / `DEV_ASSISTANT_RUNS_DB_PATH`) for tasks, runs and the pinned file
   invariants. It never reuses the RAG index store's schema.

7. **Shared UI.** `TaskStateBar`, `TraceAccordion`, `TraceStepBlock` and `StepBody` move to
   `src/components/` over `lib` types; both the agent page and the file panel render them.

## Consequences

- One implementation of the loop, FSM and invariants; the agent's behaviour is preserved (its test suite
  is green after the move) and the file assistant reuses the same engines through `@lib`.
- `AGENTS.md`'s `lib` layout grows by three modules and the "client sends ids" rule keeps applying: the
  page sends a goal/id, the plan lives in SQLite between the two server calls.
- The file assistant writes to the working tree (that is the point); `--plan-only` / the approve button
  are the safety valves, and every run prints a diff limited to the touched paths.
- `@lib` must not import features: `features/agent` and `features/dev-assistant` still never import each
  other; they meet only through `@lib`.
