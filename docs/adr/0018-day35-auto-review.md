# ADR-0018: Day-35 auto-review of a student project (Playwright + criteria)

- Status: accepted
- Date: 2026-10-16
- Area: `src/features/auto-review/**`, `src/routes/_layout/auto-review*`, `src/lib/days.ts`,
  `vitest.config.ts`, `package.json`
- Related: ADR-0014 (agent-loop/task-state/invariants in `lib`), ADR-0017 (honest completion)

## Context

Day 35 needs a page where a reviewer feeds a student's «Шесть городов» project as a zip, gets it
installed and run, and reads a verdict per defence criterion (Б1–Б3, Д1–Д29). Requirements that shape
the design:

1. The e2e checks must be **Playwright** and must cover the TЗ; the Cypress suite in the neighbouring
   `auto-review` repo is only a checklist, not a dependency.
2. Verdicts must be **reproducible**: a run must not depend on the model's mood.
3. The reviewer must be told **what failed and why**, in a fixed tone, with machine-checkable findings.
4. A project may not install or start; the report must say so instead of failing silently.
5. A second review must check **only the items that failed the first time**.

## Decision

1. **A new self-contained feature.** `src/features/auto-review/` imports only `@lib` (like
   `dev-assistant`); routes `/auto-review` (project list) and `/auto-review/$projectKey` (project run).
   Dev/local-only.
2. **Deterministic first, model second.** Б1/Б2/Б3 come only from the Playwright run — pass/fail of the
   mandatory specs, uncaught console/page errors (network errors excluded by the criterion's own wording)
   and the same suite across the configured browsers. Seven Д rules are computed statically
   (`domain/code-checks.ts`) and fed to the model as facts. The model never flips a Б verdict; it writes
   the human reason. This is why `@playwright/test` is a deliberate dependency and why the suite lives
   inside the challenge (one browser install, `baseURL` from the reviewed app).
3. **The suite mocks the API.** A reviewer cannot rely on `*.design.htmlacademy.pro`; the specs answer
   `six-cities/**` from fixtures and abort every other origin, which also removes network flakiness.
   Selectors are the markup classes the students are given, because that markup is the contract.
4. **Honest `not_checked`.** When extraction/install/serve/tests cannot produce a report, Б1–Б3 are
   `not_checked` with the cause as the reason, while code criteria still run on whatever was extracted.
   Validation verifies only that every criterion has a verdict.
5. **Task state owns the flow.** `planning` (project received, plan = criteria) → approval → `execution`
   (two parallel tracks) → `validation` → `done`, over `@lib/task-state`, reusing `TaskStateBar`.
6. **Re-review is focused.** A new review carries `resumedFrom`; the plan and the model call are limited
   to the codes that failed before, and non-focused criteria are carried over from the previous report.
7. **One detached in-process run, polled progress.** The server function starts the review and returns;
   the pipeline writes `runs` rows and the page polls (no SSE — the repo rule and the coarse progress
   granularity both point that way).
8. **Two sources, one ownership rule.** A review takes a zip or a path to an already-extracted folder
   (`sourcePath`, `--dir`). The folder is validated (`package.json`) and used in place — dependencies are
   installed there, so re-runs are fast. Because the reviewer owns that folder, `reviews.root_owned`
   records who owns the root: cleanup deletes only owned (extracted) roots and merely clears the link for
   external ones, while artifacts (ours) are always removed.
9. **Interruption is a first-class state.** Each run gets an `AbortController`; `cancelReview` aborts it,
   which kills the spawned process group (install, dev server, Playwright), and the task moves to
   `cancelled` alongside the review status `cancelled`. The pipeline checks the signal between stages and
   never overwrites a cancelled review with `done`/`failed`, so a partial run is never presented as a
   verdict.

## Consequences

- The report mixes machine verdicts and model prose; the model's findings are normalised (dash bullets,
  soft-verb casing, length cap) so the output shape is stable.
- Playwright browsers must be installed once (`npx playwright install chromium firefox`); the reviewed
  project's own source stays on disk until the reviewer clears it, and history (reviews, criteria
  results) survives that clearing.
- The reviewed project is untrusted code: dependencies are installed and the dev server runs locally, so
  the feature is documented as dev/local-only.
