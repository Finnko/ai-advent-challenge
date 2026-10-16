# ADR-0017: Tool-report budget, plan progress, and honest completion for the file assistant

- Status: accepted
- Date: 2026-10-16
- Area: `src/lib/mcp/tools.ts`, `src/lib/agent-loop/{loop,types}.ts`,
  `src/features/dev-assistant/{server,domain,mcp/files,mcp/git,components,cli}`
- Related: ADR-0014 (the shared loop / FSM / invariants engines), ADR-0015 (one file run, one path policy),
  ADR-0016 (one execution phase per plan step, the whole plan in the UI, shiki highlighting)

## Context

A write goal («обнови документацию по изменениям в коде») ran to completion without touching a single
file. The run traces are stored in the feature's runs DB (`dev-assistant-runs.sqlite`), including each
decision's `raw` model reply, and reading them made the failure mechanical rather than mysterious:

1. Every tool report was clipped at `MCP_TOOL_REPORT_MAX_CHARS = 4000`. A `read_file` of the 283-line
   feature README reported "строки 1–200 из 283" in prose but delivered ~4 KB, cut mid-file with a bare
   `…(обрезано)` and no hint about what was missing or how to continue — the tool's own `from`/`to`/
   `totalLines` lived only in `structuredContent`, which the file loop does not surface to the model.
2. The model reacted by re-issuing the same `read_file`. The loop's repeat guard (`loop.ts`) then broke the
   phase **silently** — no message told the model its call had been dropped as a duplicate.
3. Each plan step ran in its own phase with `history: []` and no memory of the earlier phases, so the step
   «обновить найденные README-файлы» could not see what the step «найти README и ADR» had found.
4. Nothing distinguished «step done» from «step gave up»: `runPlan` retried with an identical prompt, and
   `approveFileTask` reported `done` with an answer that read like success while `touched` was empty.
5. A file the assistant itself created was invisible in the reported diff: `collectTouchedDiff` uses
   `git diff HEAD -- <path>`, and untracked files do not appear there — so the "diff своих изменений"
   came back empty exactly for newly created files.

## Decision

1. **A tool-report budget that is a parameter and explains itself.** `buildMcpTools` gains
   `maxChars` (default raised to `MCP_TOOL_REPORT_MAX_CHARS = 8000`); the file feature passes
   `FILE_TOOL_REPORT_MAX_CHARS = 20000` so a default 200-line read fits. A truncated report now states how
   many characters were cut and how to narrow the window (`startLine`/`maxLines`) or pass the output on by
   `$ref`. `read_file`'s own cap message names the exact resume point (`продолжение — startLine=<n>`).
2. **The repeat guard becomes opt-in feedback.** `LoopPolicyHooks` gains `onRepeat(state, call)`, called
   once per repeated call before the loop gives up; returning a line re-asks the model with that line
   appended. The corporate agent declares no `onRepeat`, so its behaviour is unchanged.
3. **A step carries its predecessors' outcome.** `runPlan` accumulates a short progress line per finished
   step and passes it as a system block to every later phase and to validation, so a step can build on
   what earlier steps found instead of re-reading.
4. **The execution stage says what "done" means.** `FILE_STAGE_NOTES` (previously exported but unused) is
   wired into the phase prompts and gains an `execution` entry: the step is complete only after a file
   changes, or after an explicit reason why not.
5. **Completion is reported honestly.** A step whose planned paths stayed untouched is retried with a
   message naming those files; a write task that produced **no** edits at all is retried once with a
   global «ни один файл не изменён» instruction. `FilePlanRun` then exposes `unfinished` (path-level) and
   `notChanged` (nothing written), which reach the answer, the CLI and the page (a red `Alert` for
   `unfinished`, a muted note for `notChanged`). The analyzer rule also asks for concrete file paths in
   plan steps, because path-level checks depend on them.
6. **New files are diffed.** `GitSource.diff` falls back to `git diff --no-index -- /dev/null <path>` when
   the path is untracked, so a created file appears as an added-file diff. `GitRunner` gained an
   `allowExitCodes` option because `--no-index` exits 1 when the files differ.

## Consequences

- The model can finally see a whole file, knows how to page past 200 lines, and is told when it repeats
  itself; the same caps make the agent's reports more informative without changing its behaviour.
- A plan that used to end silently now either finishes the work or says what was left undone, and the diff
  shown after a run is the diff of that run's own files — including ones it just created.
- Honest reporting does not by itself make a weak model write: with the current cloud model a free-form
  «обнови документацию» goal still often ends in reads, and the run now reports `notChanged` instead of
  pretending. The cause is recorded here, next to the fixes, rather than hidden behind a green run.
- `unfinished` is only as precise as the plan: steps without file paths can only be judged by the
  «nothing written» fallback, which is why the analyzer is pushed to name files explicitly.
- The runs DB remains the debugging channel: every decision's `raw` reply is stored, which is how this
  chain was established and how the next one should be.
