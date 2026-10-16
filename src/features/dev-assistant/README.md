# Developer assistant

A page (`/dev-assistant`) where you ask questions about *this* repository and get answers backed by its
own documentation — plus live repository state (branch, status, commits, diff) pulled over MCP. This is
Day 31: RAG over the project's docs, MCP for git, and a `/help` command in an ordinary chat.

Day 32 adds a second consumer of the same engine, without a page: a headless pull-request review pipeline
(`cli/review.ts`, run by a GitHub Action) that indexes the project's docs **and code**, reviews the PR
diff and posts the findings as GitHub comments.

Day 34 turns the page into a **file assistant**: besides answering about the docs, it works with the
project's files — it searches across several files, then plans, creates and edits files under a sandbox,
and finally verifies the result with read-only tools and a diff. The loop, the task FSM and the invariants
engine are shared with the corporate agent through `@lib` (see ADR-0014).

## What it does

- **Corpus = the project's own docs.** A curated manifest (not a glob) indexes `README.md`, `AGENTS.md`,
  `GLOSSARY.md`, `CODING_STANDARDS.md`, every feature `README.md`, `docs/adr/*.md`, and a small set of
  schema/API files (SQLite DDL, contract types, `package.json` scripts). Files are read **from disk on
  demand**, so the assistant always describes the project as it is right now — there is no bundled
  snapshot to go stale.
- **Markdown-aware chunking.** Headings (`#`) drive the split; tiny sections merge, oversized ones window
  (48–256 tokens). The strategy is a private scope of the shared structural chunker: it passes its own
  heading rule and carries its own id `markdown`, so it is not registered in the shared RAG strategy
  picker and cannot collide with the wiki index.
- **Isolated index.** Its own SQLite file (`DEV_ASSISTANT_DB_PATH`, default
  `~/.ai-advent-challenge/dev-assistant.sqlite`), so the wiki index used by `/rag` is never touched.
- **Live git context over MCP.** A dedicated read-only MCP server (`dev-assistant-mcp-git`) exposes
  `git_branch`, `git_status`, `git_log`, `git_changed_files`, `git_diff`. Each tool returns a
  human-readable text *and* a structured payload (`outputSchema`/`structuredContent`), so the assistant
  reads fields (`branch`, `commits`, `clean`) instead of parsing prose. The assistant calls the tools
  once per question and injects the result as a "repository context" block; the panel and the answer
  share one spawn within a short TTL (`@lib/mcp/context.server`).
- **`/help` command.** `/help` alone returns a project map + suggested questions; `/help <question>`
  answers it; a bare question is answered too. History lives on the client only.

## How an answer is built

1. `answerAboutProject` (headless core, `server/core.server.ts`) asserts the index is built
   (`assertIndexBuilt` → shared `EmptyIndexError`) and runs `searchSources` with the docs scope
   (`markdown`, `k = 6`, no cross-encoder, no rewrite). The project corpus is small and coherent, and the
   RAG reranker (tuned for the wiki benchmark) under-scores broad questions like "what features does the
   project have?", so cosine top-k is both more accurate here and cheaper.
2. `collectGitContext` (`server/git-context.server.ts`) produces the repository context block: it names
   the git calls, spawns the git MCP server once, and reads the branch from the structured payload.
3. `answerFromSources` — the shared "sources → answer" seam of the RAG engine — runs the abstention gate
   and builds `[system, user]`: numbered doc fragments first, then the repository context, then the
   question. The JSON contract (`{"answer", "quotes"}`), quote verification and source payload are
   reused from RAG (`@lib/rag-engine.server`), so quotes are checked against the chunks.
4. If retrieval is weak *and* there is no context block, the core abstains without calling the LLM.
   Because this feature's persona sets `contextRescues`, a present git context still answers, so pure
   state questions work.

## `/help`

| Input | Behaviour |
| --- | --- |
| `/help` | project map (corpus groups + counts) and suggested questions |
| `/help <вопрос>` | answers the question like a normal chat turn |
| `<вопрос>` | answered directly |

## Module map

- `pages/DevAssistantPage.tsx` — page shell (chat + repository-context panel + index card).
- `components/AssistantChat.tsx` — client-side chat, generator toggle (cloud/local), `/help` handling.
- `components/AnswerSources.tsx` — quotes + retrieved fragments for an answer.
- `components/GitContextPanel.tsx` — the MCP git context (branch + sections).
- `components/AssistantIndexCard.tsx` — corpus status, reindex button, index stats.
- `api/use-*.ts` — react-query hooks over the server functions.
- `functions/*.functions.ts` — thin `validator → delegate` server functions.
- `server/service.server.ts` — composition: store, corpus, index build, git context + core.
- `server/core.server.ts` — `answerAboutProject`: docs scope + git blocks → shared answer seam.
  Headless, and it owns `DEV_ASSISTANT_STRATEGY`/`DEV_ASSISTANT_K`.
- `server/git-context.server.ts` — the git calls and the `GitContext` mapping for this feature.
- `server/project-corpus.server.ts` — `CorpusSource` reading the repo from disk.
- `server/markdown-chunker.server.ts` — the private markdown scope of the structural chunker.
- `server/store.server.ts` — the feature's own SQLite index.
- `server/mcp-registry.server.ts` — declares the git MCP spec for the shared `@lib/mcp` host.
- `domain/prompt.ts` — `PROJECT_PERSONA` (system prompt, fragments/context headings, abstain text).
- `domain/git/{types,context}.ts`, `mcp/git/{git,tools,register,server}.ts` — the git MCP server and the
  context shape.
- `data/corpus-manifest.ts`, `data/help.ts` — corpus list and `/help` text.
- `tests/` — offline tests for the chunker, corpus manifest, answering persona, `/help` parsing, and the
  git MCP (structured output included).

Day-32 additions:

- `cli/review.ts` — the headless entry the GitHub Action runs.
- `domain/review-prompt.ts` — `REVIEW_PERSONA` and the review JSON contract instruction.
- `domain/review-report.ts` — parse/validate the review report, anchor findings, render the body.
- `domain/pr-diff.ts` — pure unified-diff parser (paths, statuses, added-line anchors).
- `domain/review-judge-prompt.ts` — `JUDGE_PERSONA` and the verdict JSON contract instruction.
- `domain/review-verdict.ts` — parse the `{verdicts}` answer and apply keep/drop/severity to the findings.
- `server/review.server.ts` — `reviewPullRequest`: the review sibling of `answerAboutProject`.
- `server/review-judge.server.ts` — `judgeFindings`: stage two over the same chunks, fail-open.
- `server/review-corpus.server.ts` — docs + walked `code` group; `server/review-chunker.server.ts` and
  `server/code-chunker.server.ts` — the composite `review` strategy (markdown vs top-level declarations).
- `server/review-index.server.ts` — fresh `review` index over the checkout under review.
- `server/pr-diff.server.ts` — shell-git diff reader with size caps.
- `server/github.server.ts` — sticky summary + inline review delivery, step summary.
- `server/review-run.server.ts` — the orchestrator (diff → index → model → judge → anchors → delivery,
  soft degradation).

## Shared seams

- `src/lib/rag-engine.server.ts` — the app-level facade over `features/rag` (index → `searchSources` →
  `answerFromSources`), so this feature reuses the engine without importing `features/rag`.
- `src/lib/mcp/*` — the shared MCP host (spawn/client, descriptor derivation, structured output), the
  generic context collector (`context.server.ts`), the server-side helpers (`serve`, `response`) and the
  neutral MCP → `Tool` adapter (`tools.ts`).
- `src/lib/agent-loop/*`, `src/lib/task-state/*`, `src/lib/invariants/*` — the shared tool loop, task FSM
  and invariants engine (mechanics only; prompts, hints and rule registries live in the features).
- `src/components/{TaskStateBar,TraceAccordion,TraceStepBlock,StepBody}.tsx` — the shared task bar and
  trace rendering, imported by both the agent page and the file panel.
  See [ADR-0010](../../../docs/adr/0010-mcp-host-in-lib.md).
- The feature imports only `@lib`. `src/lib` composes features through its app-level modules
  (`agent-rag.server.ts`, `rag-engine.*`); everything else there stays feature-agnostic. See
  [ADR-0011](../../../docs/adr/0011-day31-architecture-refactor.md).

## Day 32 — pull-request review pipeline

The same engine, a second headless consumer with no page. `.github/workflows/pr-review.yml` runs on
`opened`/`synchronize`/`reopened` (drafts skipped) and, by hand, on `workflow_dispatch` with a PR number.

1. **Diff.** `readPullRequestDiff` runs `git diff --unified=3 base...head` (three-dot, matching GitHub's
   "Files changed"), drops lock/generated files and applies caps (40 files / 1500 lines). `parseUnifiedDiff`
   turns it into per-file added-line sets, which are both the prompt input and the anchor whitelist.
2. **Index.** `buildReviewIndex(root)` builds the `review` strategy from the checkout: the Day-31 docs
   corpus plus a walked `code` group, chunked per document — markdown by headings, code by top-level
   declarations. It lives in the same SQLite file as the chat index but under its own strategy.
3. **Context.** The diff, the changed-files list and `npm run typecheck` output are plain `contextBlocks`
   (the typecheck block gives the model real errors to reason about).
4. **Model.** `reviewPullRequest` retrieves from the `review` scope, assembles `[system, user]` through
   `buildSourceMessages` and asks for `{summary, findings:[{severity, file, line, message, suggestion}]}`.
   The cloud generator is the default; `PR_REVIEW_GENERATOR=local` points it at the Day-30 Funnel.
5. **Judge.** `judgeFindings` runs the same seam a second time over the very same retrieved chunks, with
   the numbered findings appended to the context, and asks for `{verdicts:[{id, keep, reason, severity?}]}`.
   A rejected finding is dropped, a silent one is kept, and the judge never rewrites `message`/`suggestion`,
   so the anchors validated next are still exactly the ones stage one produced. `PR_REVIEW_JUDGE=0` skips
   the stage. Fail-open: a model error or an unparsable answer keeps every finding and says so in the
   service block. Dropped findings stay visible under `<details>Отклонено судьёй (N)</details>`.
6. **Delivery.** A finding becomes an inline RIGHT-side comment only if its path and line are in the diff;
   everything else lands in the summary. Inline delivery is best effort and runs first: the batch review is
   posted in one call, and if GitHub rejects it (stale head, bad anchor) each comment is retried on its own,
   with the rejects folded into the summary. The summary — one sticky issue comment
   (`<!-- ai-pr-review -->`, created once and edited in place, duplicates deleted) — is written last and
   with paginated lookups, so a failed inline can never overwrite it.
7. **Degradation.** Any failure (index, model, API) posts "AI-ревью недоступно: …" and exits green — the
   review is advisory and never blocks the PR. A summary that was already posted is never overwritten by
   the failure note; that note then goes to the step summary only.

The core stays headless: `reviewPullRequest` knows nothing about git or GitHub, exactly like
`answerAboutProject` with its git context block.

## Day 34 — file assistant

Input on the page or in the CLI is routed deterministically (`domain/file-router.ts`): a question without
file intent returns `{ kind: 'docs' }` and the answer comes from the Day-31 RAG path; a read/search goal
runs a read-only tool loop without creating a task; a write goal stores a `planning` task and shows the
plan. Approving it runs execution → validation → done inside one server call. On the page the plan is also
answerable in text: while a plan is on screen the next message is classified by `domain/file-reply.ts`
(over `@lib/task-state/gates`) — approval words approve it, cancel/negation phrases drop it, anything with
its own file intent supersedes it and starts a new plan — so «подтверждаю» runs the plan without the button.

Two goals skip the model entirely and answer from the repository itself, which keeps them exact and
reproducible: a **repo-state** goal (`looksLikeRepoStateGoal`, e.g. «подготовь diff по изменённым
файлам») runs `collectRepoChanges` (`server/repo-diff.server.ts`) — `git_changed_files` then `git_diff`
per file — and returns a `read` outcome whose answer lists the files and whose `diff` renders in a
collapsed block; an **invariant-check** goal (`looksLikeInvariantCheckGoal`, e.g. «проверь соответствие
правилам проекта») reads the changed files through the files MCP and reports violations with
`domain/invariant-report.ts`, reusing the very predicates (`containsSecret`, `isProtectedPath`) the write
gate enforces. Both land in the runs table like any other run. Documentation sync («обновить доки по
изменениям») stays a write goal: the analyzer rule and the git tool hints make it read the diff first and
find the documents that mention the changed files before proposing a plan.

1. **Tools.** `dev-assistant-mcp-files` (`mcp/files/*`) exposes `list_files`, `read_file`, `search_text`
   (ripgrep, gitignore-aware) as read-only and `write_file`/`edit_file` as mutating. `edit_file` requires a
   unique `oldString` unless `replaceAll` is set. The sandbox rejects absolute paths, escapes above the
   root and the protected set (`.git`, `.github`, `node_modules`, `dist`, `.env*`, `*.sqlite`) on reads and
   writes alike. That set is declared once (`domain/protected-paths.ts`) and shared by the sandbox and by
   the `protected-paths` invariant, so the two can no longer drift. The git server shares the same root
   (`DEV_ASSISTANT_REPO_DIR`, git falls back to `GIT_REPO_DIR`).
2. **Core.** `server/file-run.server.ts` owns a run: it builds the loop config per phase (`read` =
   read-only, `execution` = everything, `validation` = read-only + the validation stage of the task),
   accumulates the touched paths and runs execution → validation → at most one retry
   (`runPlan`). `server/file-task.server.ts` keeps the outcome: routing, the `planning` task, and
   persistence. Execution exposes mutating tools; validation only read-only ones, so the model verifies
   with `read_file`/`search_text`/`git_status`/`git_diff`. A mismatch (a planned path was never touched,
   or nothing succeeded on validation) is what triggers the retry.
3. **Invariants.** Pinned rules live in the feature's SQLite (`server/db.server.ts`,
   `dev-assistant-runs.sqlite`): write only planned paths, no secrets in file contents, no protected paths.
   They are enforced through the shared `@lib/invariants` engine before each mutating tool; "planned
   paths" and "protected paths" are the same two predicates the sandbox and the retry decision use
   (`domain/file-paths.ts`, `domain/protected-paths.ts`).
4. **Diff.** Only the touched paths are diffed, via the git MCP (`git_diff { path }` + `git_status`), so
   unrelated uncommitted changes do not leak into the report.
5. **Reproducibility.** Page presets and `npm run file-assistant -- --scenario … | --goal …` call the same
   headless core; every run (goal, plan, trace, diff, answer) is stored and listed on the page.

The tools come from `openDevAssistantTools` (`server/mcp-tools.server.ts`), which opens **one MCP session
per server for the whole run** and closes it when the run ends: the loop makes up to 16 calls per phase and
a spawn per call would pay Node's startup each time. The MCP `Tool`s are built once per run against the
session.

Day-34 module map:

- `mcp/files/{sandbox,source,tools,register,server}.ts` — the file MCP server.
- `domain/file-router.ts` — deterministic pre-filter (`looksLikeFileTask`, `looksLikeRepoStateGoal`,
  `looksLikeInvariantCheckGoal`).
- `domain/file-reply.ts` — how the page reads a reply to a shown plan (approve | cancel | new goal).
- `domain/file-paths.ts` — one file-path pattern, plan-path extraction and planned-path matching.
- `domain/protected-paths.ts` — the single protected set (sandbox + invariant).
- `domain/file-outcome.ts` — the one shape of a file run outcome (read | plan | done).
- `domain/file-persona.ts` — base system prompt, tool hints, stage notes, `toolKey`.
- `domain/file-analyzer.ts` — the file-specific task analyzer prompt on `@lib/task-state` mechanics.
- `domain/file-invariants.ts` — pinned rules and the rule registry.
- `domain/invariant-report.ts` — static invariant check over changed files (same predicates, no drift).
- `data/file-scenarios.ts` — reproducible presets.
- `server/file-run.server.ts` — one run: phases, allowlists, touched paths, `runPlan`.
- `server/file-task.server.ts` — plan → approve → execute → validate orchestration and persistence.
- `server/file-service.server.ts` — routing between the docs path and the file core.
- `server/file-runs.server.ts`, `server/db.server.ts` — tasks, runs, invariants in their own SQLite.
- `server/file-llm.server.ts` — the loop's `CallLLM` over the cloud/local generator.
- `server/file-diff.server.ts` — diff limited to touched paths.
- `server/repo-diff.server.ts` — changed files and their diff (repo-state goal, no LLM).
- `server/repo-check.server.ts` — changed files' contents + `domain/invariant-report` (check goal, no LLM).
- `server/mcp-tools.server.ts` — opens the session-bound tool set for this feature's registry (files + git).
- `components/FileOutcomeView.tsx`, `components/FileRunsPanel.tsx`, `api/use-file-task.ts`,
  `functions/file-task.functions.ts`, `cli/file-assistant.ts`.

## Run

```bash
npm run build:mcp                    # build the git MCP server (plus the agent's servers)
# .env: DEEPSEEK_API_KEY (cloud generator) or a running mlx_lm.server (local generator)
npm run dev                          # open /dev-assistant, press «Переиндексировать», ask questions
```

`GIT_REPO_DIR` overrides the repository the git MCP server reads (defaults to `process.cwd()`), and
`DEV_ASSISTANT_REPO_DIR` overrides where the corpus is read from. `DEV_ASSISTANT_MCP_GIT_ENTRY`,
`DEV_ASSISTANT_DB_PATH` are the usual overrides.

The file assistant from the CLI (`--plan-only` is the default for write goals; `--apply` executes):

```bash
npm run file-assistant -- --scenario find-usages       # read: no task, search only
npm run file-assistant -- --scenario repo-changes      # read: deterministic list + diff
npm run file-assistant -- --scenario invariants-check  # read: deterministic invariant report
npm run file-assistant -- --scenario demo-doc         # write: prints the plan
npm run file-assistant -- --scenario demo-doc --apply # executes, validates, prints the diff
npm run file-assistant -- --scenario update-docs      # write: sync docs with the code diff
npm run file-assistant -- --goal "где используется answerAboutProject"
```

`FILE_ASSISTANT_GENERATOR=local` switches the file assistant to the local model,
`DEV_ASSISTANT_RUNS_DB_PATH` overrides the runs database. Remember to `npm run build:mcp` so the files
server ships as `dist/server/mcp/mcp-files.mjs`.

A dry run of the review pipeline (no PR, no posting — prints the rendered review):

```bash
PR_BASE_SHA=<base ref> PR_REVIEW_DRY_RUN=1 npm run review:pr
# or point at a real PR (needs GITHUB_TOKEN + GITHUB_REPOSITORY + PR_NUMBER):
gh workflow run pr-review.yml -f pr=123
```

`PR_REVIEW_GENERATOR=local` switches generation to the local model (via `@lib/local-llm.server`),
`PR_REVIEW_SKIP_TYPECHECK=1` drops the typecheck context block, `PR_REVIEW_JUDGE=0` disables the
judge stage (stage two of the pipeline, both stages otherwise share the generator).

## Decisions and porting

See [ADR-0009](../../../docs/adr/0009-shared-rag-engine-and-dev-assistant.md) (shared RAG engine + this
feature), [ADR-0010](../../../docs/adr/0010-mcp-host-in-lib.md) (MCP host moved to `src/lib`),
[ADR-0011](../../../docs/adr/0011-day31-architecture-refactor.md) (deepened search/answer seams,
structured git output, no `lib` → feature imports),
[ADR-0012](../../../docs/adr/0012-pr-review-pipeline.md) (the Day-32 review pipeline),
[ADR-0013](../../../docs/adr/0013-review-judge-stage.md) (the judge stage) and
[ADR-0014](../../../docs/adr/0014-agent-loop-task-state-invariants-in-lib.md) (the shared loop/FSM/invariant
engines). The Day-34 pass that deepened the run module and the two path predicates is recorded in
[ADR-0015](../../../docs/adr/0015-day34-architecture-refactor.md). The feature never imports `features/rag`
or `features/agent`.
