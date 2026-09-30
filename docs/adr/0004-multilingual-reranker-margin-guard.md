# ADR-0004: Multilingual reranker and margin guard for the second retrieval stage

- Status: accepted
- Date: 2026-10-01
- Area: `src/features/rag/server/reranker.server.ts`, `src/features/rag/server/retrieval.server.ts`
- Supersedes: [ADR-0003](0003-reranker-onnx-model.md)

## Context

ADR-0003 wired the second retrieval stage to `Xenova/bge-reranker-base` as the default. That checkpoint
is trained for Chinese + English, not multilingual, and the corpus is Russian. The failure surfaced on
the eval question «Какой город основал Пётр I в 1703 году?»: the bi-encoder gave the Yekaterinburg and
St. Petersburg chunks an identical cosine (`0.786`), where stable sorting + `ORDER BY doc_id` left
St. Petersburg first; the reranker then scored Yekaterinburg `0.976` against St. Petersburg `0.901` and,
because `selection` overwrote the cosine score outright, promoted the wrong city. Disabling the reranker
returned St. Petersburg first — the model was the regression.

## Decision

1. Default the reranker to `onnx-community/bge-reranker-v2-m3-ONNX` (multilingual, `q8`), verified by a
   trial load through `@huggingface/transformers` v4. `onnx-community/gte-multilingual-reranker-base`
   was the lighter candidate but is unusable (`Unsupported model type: new` — ModernBERT).
2. Add a **margin guard** in `retrieval.server.ts` (`compareWithMargin`): when candidate cosines are
   tied (`|Δcos| ≤ COSINE_TIE_EPSILON`) and the rerank-score gap is below `RAG_RERANK_MARGIN`
   (default `0.1`), keep the cosine order. The reranker may only flip a cosine tie with a confident
   margin.

On the failure case the multilingual model scores the correct St. Petersburg intro chunk `0.975` versus
Yekaterinburg `0.114`, so it wins before the guard applies.

## Consequences

- The correct chunk is retrieved and cleared the `0.5` threshold; the wrong city no longer leaks in.
- `bge-reranker-v2-m3` (0.6B) is heavier/slower than the replaced base checkpoint; the speed-first
  alternative was incompatible, so quality won.
- The guard comparator is pairwise with an epsilon fallback to cosine, so it is not a strict weak
  ordering; its behaviour is deterministic for a given input and pinned by `rerank.test.ts`.
- `RAG_RERANK_MODEL` / `RAG_RERANK_MARGIN` remain the configuration seam; the transformers.js
  compatibility rule from ADR-0003 still applies to any new checkpoint.
