# Developer assistant

A page (`/dev-assistant`) where you ask questions about *this* repository and get answers backed by its
own documentation — plus live repository state (branch, status, commits, diff) pulled over MCP. This is
Day 31: RAG over the project's docs, MCP for git, and a `/help` command in an ordinary chat.

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

## Shared seams

- `src/lib/rag-engine.server.ts` — the app-level facade over `features/rag` (index → `searchSources` →
  `answerFromSources`), so this feature reuses the engine without importing `features/rag`.
- `src/lib/mcp/*` — the shared MCP host (spawn/client, descriptor derivation, structured output), the
  generic context collector (`context.server.ts`) and the server-side helpers (`serve`, `response`).
  See [ADR-0010](../../../docs/adr/0010-mcp-host-in-lib.md).
- The feature imports only `@lib`. `src/lib` composes features through its app-level modules
  (`agent-rag.server.ts`, `rag-engine.*`); everything else there stays feature-agnostic. See
  [ADR-0011](../../../docs/adr/0011-day31-architecture-refactor.md).

## Run

```bash
npm run build:mcp                    # build the git MCP server (plus the agent's servers)
# .env: DEEPSEEK_API_KEY (cloud generator) or a running mlx_lm.server (local generator)
npm run dev                          # open /dev-assistant, press «Переиндексировать», ask questions
```

`GIT_REPO_DIR` overrides the repository the git MCP server reads (defaults to `process.cwd()`), and
`DEV_ASSISTANT_REPO_DIR` overrides where the corpus is read from. `DEV_ASSISTANT_MCP_GIT_ENTRY`,
`DEV_ASSISTANT_DB_PATH` are the usual overrides.

## Day 32 hook

The core is headless: `answerAboutProject({ question, store, generator, contextBlocks })` knows nothing
about UI, HTTP or MCP — the store is the only engine dependency and the context blocks are plain text.
A GitHub Action only needs to (a) index the repo (the manifest is a parameter, so a code corpus can be
added) and (b) pass a diff/changed-files block as `contextBlocks`. No UI or MCP changes required.

## Decisions and porting

See [ADR-0009](../../../docs/adr/0009-shared-rag-engine-and-dev-assistant.md) (shared RAG engine + this
feature), [ADR-0010](../../../docs/adr/0010-mcp-host-in-lib.md) (MCP host moved to `src/lib`) and
[ADR-0011](../../../docs/adr/0011-day31-architecture-refactor.md) (deepened search/answer seams,
structured git output, no `lib` → feature imports). The feature never imports `features/rag` or
`features/agent`.
