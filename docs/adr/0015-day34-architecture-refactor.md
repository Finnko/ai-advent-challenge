# ADR-0015: Day-34 architecture refactor — one file run, one path policy, MCP sessions

- Status: accepted
- Date: 2026-10-16
- Area: `src/features/dev-assistant/{domain,server,mcp/files}`, `src/lib/{agent-loop,invariants,mcp}`
- Related: ADR-0010 (MCP host in `lib`), ADR-0011 (deep seams, no `lib` → feature imports), ADR-0014 (shared
  loop / FSM / invariants engines and the Day-34 file assistant)

## Context

A review of the Day-34 work (the file assistant plus the extraction of the loop, FSM and invariant engines
into `@lib`) found four kinds of friction, all in the newest code:

1. `server/file-task.server.ts` drove five phases through one `runPhase({…})` with ten fields each. Which
   tools a phase exposes, which token budget it gets and which task stage it carries were literals spread
   over `runFileGoal`/`approveFileTask`, so the retry was a verbatim copy of two of them.
2. Two predicates answered "is this file one the plan named?" (`isPlanned` in `domain/file-invariants.ts`,
   `pathMatched` in `server/file-task.server.ts`) and they disagreed — one compared paths for equality, the
   other only by suffix. They gate different outcomes: one blocks a write, the other decides the plan was
   satisfied.
3. The protected-path policy existed twice, as the sandbox denylist (`.git`, `node_modules`, `dist`,
   `.env*`, `*.sqlite`, any segment) and as the `protected-paths` invariant (`^\.github/`, `^\.git/`,
   `^dist/`, `(^|\/)\.env`). They had already drifted: `.github/` was protected only by the invariant,
   `node_modules` and `*.sqlite` only by the sandbox.
4. `@lib/mcp/client.server.ts` spawned a server process per call (`withClient` → `connect` → `call` →
   `close`). That was acceptable while MCP tools were an occasional capability; Day 34 turned them into the
   file loop's hot path (up to 16 calls per phase, 3–5 phases per run).
5. Two smaller leftovers: the file run outcome was declared by hand three times (`FileTaskOutcome`,
   `FileTaskOutcomeView`, `FileTaskView`/`FileApproveView`, the last needing `as FileApproveView`), and the
   extracted engines had no test surface of their own — `runToolLoop` was covered only through the
   corporate agent. Its `LoopHooks` was one flat object of fourteen optional members, and
   `InvariantRule.testAnswer` demanded a context, so the agent fabricated an identity
   (`{ name: '', role: 'employee', … }`) for rules that ignore it.

## Decision

1. **One file run is a module.** `server/file-run.server.ts` owns `createFileRun`: it derives the allowlist
   and the task stage from the phase name, builds the `runToolLoop` config, accumulates touched paths, and
   exposes `phase()`, `runPlan()` (execution → validation → at most one retry) and `touched()`.
   `server/file-task.server.ts` keeps routing, the `planning` task and persistence. Planning no longer opens
   the MCP servers at all: the read phase is the only branch in `runFileGoal` that needs tools.
2. **One module owns paths in text.** `domain/file-paths.ts` holds the file-extension pattern,
   `looksLikeFilePath` (routing), `extractPlanPaths` (the plan) and `matchesPlannedPath` (the single
   predicate behind both the write gate and the retry decision). `domain/file-router.ts` uses it.
3. **One protected set.** `domain/protected-paths.ts` declares `PROTECTED_DIRS`, the protected file
   patterns, `isProtectedPath` and the error text. `mcp/files/sandbox.ts` (reads and writes) and
   `domain/file-invariants.ts` (mutating tools) both call it; the invariant text states the same list. Being
   one list makes protection strictly stronger than before: `.github/` is now denied to reads too.
4. **A session, not a spawn per call.** `@lib/mcp/client.server.ts` gains `openMcpSession(config)` →
   `{ name, listTools, call, close }` next to the existing per-call helpers, which are now thin wrappers over
   the same `listToolsWith`/`callToolWith`. `server/mcp-tools.server.ts` exposes `openDevAssistantTools()`
   → `{ tools, close }`, opening one session per registry server, listing tools once, and binding the MCP
   `Tool`s to the session. `runFileGoal` and `approveFileTask` close the toolbox in a `finally`.
5. **One spelling of the outcome.** `domain/file-outcome.ts` declares the `read | plan | done` shape once;
   `server/file-task.server.ts` adds the `{ kind: 'docs' }` marker, `types.ts` re-exports it for the client
   and `file-service.server.ts` returns it without casts (`approveFileTask` returns `FileOutcome`, so
   `FileApproveView` disappears). `FileRunView`/`FileScenarioView` were dead and are gone.
6. **The engines get their own surface.** `src/lib/agent-loop/loop.test.ts` tests `runToolLoop` directly
   with a scripted `CallLLM` and fake `Tool`s: `$ref` (including `refText`), the repeat guard,
   `maxActions`, the nudge, gate refusals, action/answer invariant hits, the fail-open guard, the silent
   pause, the input/context budgets, usage and cost. `LoopHooks` splits into `prompts` (required),
   `policy` (optional) and the two runtime hooks; `InvariantRule.testAnswer` no longer takes a context, so
   `runAnswerChecks` stops inventing an `AgentIdentity`.
7. **Pure re-exports are gone.** `features/agent/domain/task/{state,types,advance}.ts` and
   `domain/mcp/args-example.ts` are deleted; the agent and its tests import `@lib/task-state/*` and
   `@lib/mcp/args-example` directly. `domain/task/read.ts` stays — it adds the feature's `SystemBlock`
   wrapper — and `domain/invariants/types.ts` stays because it adds `invariantCheckIds`.

## Consequences

- The file run has one place to change: a new phase, a budget or an allowlist rule is no longer a
  five-way edit, and the retry stops being a copy.
- The sandbox and the invariant can no longer disagree about what is protected, and the planned-path
  predicate can no longer disagree with itself; both facts are covered by tests
  (`files-mcp.test.ts` asserts `.github/` and `src/dist/generated.ts`, `file-task.test.ts` asserts the
  write-gate vs retry behaviour).
- An approved file run spawns two MCP processes instead of tens; the corporate agent keeps the per-call
  helpers and is untouched.
- The extracted engines are now tested through their own interface, which is what makes the second
  consumer (`features/dev-assistant`) safe: a behaviour change in the loop fails in `lib`, not only in the
  agent's suite.
- `features/agent` lost four pass-through modules; ADR-0014 called them "thin delegators", which described
  the state right after the move, not a rule. `@lib/...` is now the only way the feature reaches the shared
  engines.
