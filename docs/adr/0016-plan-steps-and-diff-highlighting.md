# ADR-0016: One execution phase per plan step, the whole plan in the UI, and shiki for diff highlighting

- Status: accepted
- Date: 2026-10-16
- Area: `src/features/dev-assistant/{domain,server,components}`, `src/components/TaskStateBar.tsx`, `src/styles.css`
- Related: ADR-0014 (the loop / FSM / invariants extraction and the Day-34 file assistant), ADR-0015 (one
  file run, one path policy, MCP sessions)

## Context

Three defects showed up when the Day-34 file assistant was used for a real write goal ("подготовь diff по
изменённым файлам … обнови доки"):

1. **The run stopped after the first plan step.** `runPlan` ran a single `execution` phase for the whole
   plan, then `validation`. But the loop itself tells the model to stop at the end of a step
   (`@lib/agent-loop/loop.ts` appends `Если шаг выполнен — верни {"tool": null}` after every tool report),
   and the feature's decide prompt said «выбери ровно один инструмент, который продвигает цель на один
   шаг». So the model advanced one step, returned `tool: null`, and the phase ended. The retry only fired
   when a planned path was left untouched, and `extractPlanPaths` only recognises paths with a file
   extension — a plan whose steps named no files (e.g. "посмотреть diff") could not trigger it at all.
2. **The UI showed only the current step.** `TaskStateBar` rendered `state.step` and put the full list into
   a `title` tooltip, so a five-step plan read as «шаг 1/5» with no way to see the rest.
3. **The diff was a grey wall.** Both `read` and `done` outcomes rendered `outcome.diff` in a plain
   `<pre className="demo-code-block">`; added and removed lines only differed by their leading character.

The repo treats every non-LLM SDK as a deliberate decision, so the highlighter is the third part of this
ADR rather than an incidental import.

## Decision

1. **One execution phase per plan step.** `createFileRun(...).runPlan()` iterates `state.steps`, runs an
   `execution` phase for each with that step as the current one, then a single `validation` phase. A phase
   whose run is not `ok` (a blocked invariant) aborts the rest of the plan. The retry re-runs only the steps
   whose own planned paths (`pathsInText(step)`) stayed untouched, then re-runs validation; a plan with no
   named paths is retried only when validation produced no read-only verification. `FilePlanRun.execution`
   became `executions: LoopRunResult[]`, and `composeAnswer` joins their answers. «Шаг N/M» now advances
   because each phase carries its own `stepIndex`.
2. **The feature tells the loop what "done" means.** `FILE_DECIDE_SCOPE_LINES` no longer says "one step
   only": it asks to work the current step to the end and to return `{"tool": null}` only when the step is
   closed. `executionStepLine(index, total, step)` names the step in the decide prompt, and the nudge repeats
   it. `@lib` is untouched — the fix stays in the feature.
3. **The whole plan is visible.** `TaskStateBar` renders every `state.steps` entry as an ordered list with
   the current `stepIndex` highlighted; the tooltip is gone. The bar is shared with `/agent`, which gets the
   same view.
4. **shiki for diff highlighting.** `shiki` (v4) is the one new dependency, used through its fine-grained
   bundle: `createHighlighterCore` + `createJavaScriptRegexEngine` (no WASM), only `@shikijs/langs/diff` and
   the `github-light`/`github-dark` themes. `components/DiffBlock.tsx` lazily imports it, calls
   `codeToTokens(diff, { lang: 'diff', themes: { light, dark }, defaultColor: false })` and renders the
   tokens as `<span style={token.htmlStyle}>` — no `dangerouslySetInnerHTML`. `+`/`-`/`@@`/`+++` rows get a
   tinted background from the semantic tokens (`--positive`, `--danger`, `--accent`); `styles.css` maps
   `--shiki-light`/`--shiki-dark` onto the active `data-theme`, including the `prefers-color-scheme`
   fallback. The highlighter is a client-only lazy chunk; `domain/` and `server/` never import shiki, so the
   review CLI and `build:mcp` (plain Node) stay clean.

## Consequences

- Every plan step is attempted, and a step the model skips is retried explicitly rather than silently
  dropped; `tests/file-task.test.ts` covers "each step runs" (fails on the previous single-phase code) and
  "only the missed steps are retried".
- A five-step plan costs more model calls than before (one loop budget per step). That is the price of
  actually finishing the plan; a `maxActions` budget per phase still caps a runaway step.
- Diff rendering is now theme-consistent in light and dark, and the added chunk is fetched only when a diff
  is shown (shiki ships as `core`, `engine-javascript`, and per-theme chunks).
- The new dependency is scoped to one client component; if a second consumer ever needs diff highlighting,
  `DiffBlock` moves to `src/components/`.
