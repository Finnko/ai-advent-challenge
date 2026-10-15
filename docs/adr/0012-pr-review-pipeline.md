# ADR-0012: Day-32 automated pull-request review pipeline

- Status: accepted
- Date: 2026-10-14
- Area: `src/features/dev-assistant/{cli,domain,server}`, `src/lib/rag-engine.*`,
  `src/features/rag/server/corpus.server.ts`, `.github/workflows/pr-review.yml`
- Related: ADR-0005 (answer contract/abstention), ADR-0009 (shared RAG engine + dev-assistant),
  ADR-0010 (MCP host in `lib`), ADR-0011 (deep search/answer seams)

## Context

Day 31 left an explicit hook: `answerAboutProject({ question, store, generator, contextBlocks })` is
headless, `contextBlocks` is plain text, and the corpus manifest is a parameter — "a GitHub Action only
needs to (a) index the repo and (b) pass a diff/changed-files block". Day 32 is that Action, and it adds
four constraints the answering path did not have:

1. A pull request needs **line-anchored** findings (GitHub inline comments), not just a prose answer, so
   the answering JSON contract (`{answer, quotes}`) does not fit — the review needs `{summary, findings}`.
2. The review must reason about **code**, while the Day-31 corpus is documentation only.
3. GitHub-hosted runners cannot reach the local MLX endpoint (loopback on the Mac), so the pipeline needs
   a cloud-reachable generator and locally-runnable embeddings.
4. The RAG engine was only ever executed **inside Vite**; a CLI entry has to load it in a plain Node
   process.

## Decision

1. **A sibling headless entry, not a second feature.** `reviewPullRequest` lives in
   `features/dev-assistant/server/review.server.ts`, next to `answerAboutProject`. It composes the same
   deep seams — `searchSources` + `buildSourceMessages` + `resolveAnswerLlm` — with a `REVIEW_PERSONA` and
   a review JSON contract (`domain/review-prompt.ts`, `domain/review-report.ts`). `features/rag` gains only
   two seam exports (`buildSourceMessages` and the `Embedder` type) through the app-level facade; nothing
   else moves, and dev-assistant still imports only `@lib`.

2. **The review corpus is docs + code, one strategy.** `review-corpus.server.ts` keeps the curated docs
   manifest and adds a walked `code` group (`src/lib`, `src/features`, `src/routes`, `src/components`,
   tests/fixtures/`*.d.ts` excluded). `review-chunker.server.ts` dispatches per document to a private
   markdown chunker or a private **code chunker** (top-level declarations, `code-chunker.server.ts`), both
   built with the same id `review`, so `Chunk.strategy`, chunk ids and the store's per-strategy rows agree.
   The id stays unregistered in the shared picker, exactly like `markdown` (ADR-0011 §5).

3. **A fresh `review` index, never the chat one.** `buildReviewIndex(root)` indexes the checkout under
   review into the feature's SQLite file under the `review` strategy. `/dev-assistant`'s `markdown` index
   is untouched; a PR reindex never affects the page.

4. **The diff comes from `git`, the delivery from the GitHub API.** `pr-diff.server.ts` runs
   `git diff --unified=3 base...head` (three-dot, matching "Files changed"), parses it into per-file
   added-line sets (`domain/pr-diff.ts`, pure and unit-tested), drops lock/generated files and applies
   caps (40 files / 1500 lines) so the block cannot eat the whole context. The git MCP server is **not**
   reused here: its `maxLines` cap (≤ 1000) would truncate exactly the anchors the review needs.
   `github.server.ts` is the only place that writes to GitHub.

5. **Anchors are validated, never trusted.** A finding becomes an inline comment only if its path matches
   a diff file and its line is an added/changed RIGHT line; everything else (architecture notes, findings
   without a valid anchor, or a prose answer that failed JSON parsing) falls back into the summary comment,
   so the review never loses information and GitHub never returns 422.

6. **Idempotent delivery.** The summary is one sticky issue comment carrying `<!-- ai-pr-review -->`
   (created once, edited in place); previous bot inline comments are deleted and re-posted as a single
   `COMMENT` review on the current head. Every comment body carries the marker.

7. **Cloud generator, local embeddings, soft degradation.** The runner uses the DeepSeek key for
   generation and the local ONNX embedder (cached) for retrieval; `PR_REVIEW_GENERATOR=local` swaps in the
   Day-30 Funnel endpoint without code changes. Ground truth from `npm run typecheck` joins the diff as one
   more context block. A failing index, model or API call posts "AI-ревью недоступно: …", writes the job
   summary and exits green — the review is advisory and must never block a PR.

8. **Manual re-run both ways.** `workflow_dispatch` with a `pr` input re-runs the pipeline on any PR by
   hand (`gh workflow run pr-review.yml -f pr=123`); GitHub's built-in "Re-run jobs" already covers the
   same-head case.

9. **The engine must load outside Vite.** `features/rag/server/corpus.server.ts` wrapped its
   `import.meta.glob` wiki-snapshot macro in a lazy initializer: the macro is only evaluated when the wiki
   corpus is actually used, so the module (and the whole `@lib` facade) can be imported by a plain Node
   entry, which is how the CLI runs (`node --import ./scripts/mcp-alias-loader.mjs cli/review.ts`, the same
   mechanism that runs `.ts` MCP servers in dev).

## Consequences

- The Day-31 hook is honoured literally: the diff arrives as `contextBlocks`, and the core never learns
  about GitHub, git or the workflow.
- Reuse is measured: the review adds a persona, a contract parser and a diff reader; retrieval, embeddings,
  the store, message assembly and the LLM switch are the shared paths.
- Cost: the review corpus embeds ~480 documents (~3.5k chunks) on every run; the model cache keeps the
  download out of the loop, but a run still takes minutes. Caps bound the diff, not the corpus.
- Cost: `rag-engine`'s public surface grew by two entries (`buildSourceMessages`, `Embedder`), and
  `features/rag` carries one Node-compatibility change it would not have needed for the web app alone.
- The `review` strategy must be rebuilt whenever the corpus layout changes; it is intentionally not shared
  with the `markdown` index, so the two can never clobber each other.
