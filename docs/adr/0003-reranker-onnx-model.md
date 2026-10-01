# ADR-0003: Cross-encoder reranker runs on transformers.js-compatible ONNX weights

- Status: superseded by [ADR-0004](0004-multilingual-reranker-margin-guard.md)
- Date: 2026-09-30
- Area: `src/features/rag/server/reranker.server.ts`

## Context

Day 23 adds a second retrieval stage after cosine top-`candidateK`: reorder candidates by relevance and
cut the weak ones with a threshold. The task allowed a threshold-only filter, a separate model, or a
heuristic. A cross-encoder scores a `(query, passage)` pair jointly and is the strongest option, but it
needs its own model — the embedding bi-encoder cannot score pairs.

`@huggingface/transformers` is already a dependency (used by `server/embedder.server.ts`), so a local
ONNX cross-encoder adds no new SDK. The intended default, `jinaai/jina-reranker-v2-base-multilingual`,
turned out to be unusable: its `config.json` has `model_type: null`, which the library rejects with
`Unsupported model type`.

## Decision

The reranker is a local ONNX cross-encoder loaded through `@huggingface/transformers`, default
`Xenova/bge-reranker-base` (`q8`), configured by `RAG_RERANK_MODEL`/`RAG_RERANK_DTYPE`. Logits pass
through a sigmoid; the threshold (`RAG_RERANK_THRESHOLD`, default 0.5) is applied after reranking.
Inference **fails open**: on any load/run error the stage falls back to cosine order and the response
reports `reranked: false`.

A candidate model must be transformers.js-compatible — a non-empty `model_type` with ONNX weights in
the repository. New models are verified by a trial load before being wired into an env default.

## Consequences

- No new dependency; the ONNX models stay isolated to `embedder.server.ts` and `reranker.server.ts`
  (the deliberate Day-23 SDK decision recorded in `AGENTS.md`).
- Offline after the one-time model download; the demo and offline tests use `createLexicalReranker`
  or an injected fake.
- The model id is a configuration choice, not a hardcoded one; swapping rerankers is one env var, but
  only across transformers.js-compatible checkpoints.
