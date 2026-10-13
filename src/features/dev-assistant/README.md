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
  (48–256 tokens). This strategy is private to the feature and is *not* registered in the shared RAG
  strategy picker.
- **Isolated index.** Its own SQLite file (`DEV_ASSISTANT_DB_PATH`, default
  `~/.ai-advent-challenge/dev-assistant.sqlite`), so the wiki index used by `/rag` is never touched.
- **Live git context over MCP.** A dedicated read-only MCP server (`dev-assistant-mcp-git`) exposes
  `git_branch`, `git_status`, `git_log`, `git_changed_files`, `git_diff`. The assistant calls them once per
  question and injects the result as a "repository context" block. The block is supplementary: docs are
  primary, context answers state questions ("what branch am I on?").
- **`/help` command.** `/help` alone returns a project map + suggested questions; `/help <question>`
  answers it; a bare question is answered too. History lives on the client only.

## How an answer is built

1. The headless core (`server/core.server.ts`) retrieves the top-k chunks by cosine similarity — no
   cross-encoder. The project corpus is small and coherent, and the RAG reranker (tuned for the wiki
   benchmark) under-scores broad questions like "what features does the project have?"; cosine top-k is
   both more accurate here and cheaper (no model download per turn).
2. `getGitContext` (via `@lib/git-context.server`) produces the repository context block.
3. `buildProjectMessages` composes `[system, user]`: numbered doc fragments first, then the repository
   context, then the question. The JSON contract (`{"answer", "quotes"}`), quote verification and source
   payload are **reused from RAG** (`@lib/rag-engine.server`), so quotes are checked against the chunks.
4. If retrieval is empty/weak *and* there is no context block, the core abstains without calling the LLM.
   With git context present it still answers, so pure state questions work.

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
- `server/core.server.ts` — `answerAboutProject`: retrieval → messages → LLM → parse/verify. Headless.
- `server/project-corpus.server.ts` — `CorpusSource` reading the repo from disk.
- `server/markdown-chunker.server.ts` — the private markdown structural chunker.
- `server/store.server.ts` — the feature's own SQLite index.
- `server/mcp-registry.server.ts` — declares the git MCP spec for the shared `@lib/mcp` host.
- `domain/prompt.ts` — project system prompt + message builder (reuses RAG's JSON contract).
- `domain/git/types.ts`, `mcp/git/{git,tools,register,server}.ts` — the git MCP server.
- `data/corpus-manifest.ts`, `data/help.ts` — corpus list and `/help` text.
- `tests/` — offline tests for the chunker, corpus manifest, prompt, `/help` parsing, and the git MCP.

## Shared seams

- `src/lib/rag-engine.server.ts` — the app-level facade over `features/rag` (corpus → chunks →
  embeddings → index → retrieval), so this feature reuses the engine without importing `features/rag`.
  The feature imports only `@lib`.
- `src/lib/git-context.server.ts` — composes the git MCP host into context blocks.
- `src/lib/mcp/*` — the shared MCP host (spawn/client, descriptor derivation) and the server-side helpers
  (`serve`, `response`). See [ADR-0010](../../../docs/adr/0010-mcp-host-in-lib.md).

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

The core is headless: `answerAboutProject({ question, sources, contextBlocks, generator })` knows nothing
about UI, HTTP or MCP. A GitHub Action only needs to (a) index the repo (the manifest is a parameter, so a
code corpus can be added) and (b) pass a diff/changed-files block as `contextBlocks`. No UI or MCP changes
required.

## Decisions and porting

See [ADR-0009](../../../docs/adr/0009-shared-rag-engine-and-dev-assistant.md) (shared RAG engine + this
feature) and [ADR-0010](../../../docs/adr/0010-mcp-host-in-lib.md) (MCP host moved to `src/lib`). The
feature never imports `features/rag` or `features/agent`; it reaches the RAG engine through
`@lib/rag-engine.server` and git through `@lib/mcp` + its own MCP spec, mirroring how `features/rag` and
`features/agent` are composed at the app level.
