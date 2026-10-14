# ADR-0009: Shared RAG engine seam and the developer-assistant feature

- Status: accepted
- Date: 2026-10-13
- Area: `src/lib/rag-engine.{types,server}.ts`, `src/features/dev-assistant/**`
- Related: ADR-0005 (answer contract/abstention), ADR-0008 (local model as a service)

## Context

Day 31 asks for an assistant that answers questions about the project itself: README and `docs/` go into
RAG, git state comes over MCP, and a `/help` command answers questions about the project. Two forces
collide with the existing layout:

1. The RAG machinery (corpus source, chunking, embeddings, index store, retrieval, answer contract) lives
   inside `features/rag`, and the repository rule is that features do not import each other except through
   an app-level seam (`agent-rag.server.ts` composes RAG into the agent).
2. The RAG corpus is a single hard-coded set (15 Wikipedia city articles), split only by chunking
   strategy; adding a second corpus in place would clobber the wiki index (shared `rag_chunks` keyed by
   `strategy`, `rag_documents` keyed by `doc_id`).
3. A Day-32 GitHub Action will need the same "docs (and code) + diff → review text" behaviour, so the
   answering path must be callable without the web UI, MCP or git.

## Decision

1. **One app-level RAG facade.** `src/lib/rag-engine.server.ts` re-exports the pieces of
   `features/rag/server` needed to build an index and answer (corpus, chunking windows, embedder, index
   store, retrieval/stitch, answer LLM, answer parse/verify, scoring, store path). `features/rag` keeps
   owning the internals and remains the first consumer; it is not restructured. The only change inside it
   is an optional `chunker` on `BuildIndexOptions`, so a caller can supply its own strategy.
2. **The developer assistant is a new, self-contained feature.** It imports only `@lib`, never
   `features/rag` or `features/agent`. It owns:
   - a curated markdown corpus read from disk (`server/project-corpus.server.ts` + `data/corpus-manifest.ts`);
   - a **private** markdown structural chunker (not registered in the shared strategy picker);
   - its **own** SQLite index (`DEV_ASSISTANT_DB_PATH`, default `dev-assistant.sqlite`);
   - a project-specific system prompt that **reuses** the RAG JSON contract, quote verification and
     source payload.
3. **Cosine top-k, no cross-encoder, for this feature.** The corpus is small and coherent, and the RAG
   reranker (tuned for the wiki benchmark) under-scores broad questions such as "what features does the
   project have?", collapsing results to a single fragment. Cosine top-k is more accurate here and cheaper
   (no reranker model per turn). The retrieval plumbing is still the shared one.
4. **Context blocks are injected, the core stays headless.** `answerAboutProject` takes plain-text
   `contextBlocks` and knows nothing about git or MCP. Today the git MCP server supplies the block on the
   page; Day 32 can supply a diff from a GitHub Action. Missing docs do not force abstention when a
   context block is present, so pure repository-state questions are answered.

## Consequences

- The wiki demo in `/rag` is untouched: different corpus, different index file, shared engine only.
- Reuse is real: answer parsing, quote verification, embeddings and the store are the same code paths as
  RAG (ADR-0005 still governs the contract).
- Adding a code corpus for Day 32 is a parameter, not a rewrite: pass another manifest to the corpus
  source and index it with the same engine.
- Cost: `src/lib/rag-engine.server.ts` is a facade over another feature; like `agent-rag.server.ts`, it is
  deliberate app-level composition, not a new dependency of `features/rag`.
