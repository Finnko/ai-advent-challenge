# ADR-0005: Structured answer contract (sources + quotes) and threshold abstention

- Status: accepted
- Date: 2026-10-02
- Area: `src/features/rag/domain/answer-{prompt,format,eval}.ts`, `src/features/rag/server/answer.server.ts`
- Supersedes: —

## Context

Day 22's RAG answer was free-form prose with inline `[n]` citations; the retrieved sources were already in
the API response, but the model was never obliged to emit quotes, and a fabricated or paraphrased «quote»
could not be told apart from a verbatim one. The relevance threshold from Day 23 did not gate the answer
path either: `retrieval.selectResults` forces a guaranteed minimum of one result, so an irrelevant query
always produced an answer instead of an honest «I don't know».

## Decision

1. **Sources stay server-derived.** The source list (`title`, `source` URL, `section`, `chunk_id`, score)
   is metadata of the retrieved chunks; the LLM never fabricates it. It is an invariant of the response.
2. **The model returns strict JSON**: `{"answer": "...", "quotes": [{"n": 1, "text": "..."}]}`
   (`response_format: json_object`, temperature `0`, `ANSWER_MAX_TOKENS` raised to 1200). `parseAnswerResponse`
   fails open to plain text (`format: 'text'`, empty quotes) if the JSON is malformed.
3. **Quotes are verified deterministically** (`verifyQuotes`): a quote counts only if its normalized text is
   a substring of the chunk it cites. A RAG answer with no verified quote, or with matched expected facts
   not backed by any verified quote, is `ungrounded`.
4. **Abstention is a gate, not a hope.** If the top candidate's score is below the active threshold — rerank
   `relevance` for reranked pipelines, cosine for `rag`/`rag+rewrite` (`RAG_COSINE_THRESHOLD`, default
   `0.35`) — the server returns a deterministic «не знаю, уточните» answer, empty sources/quotes and
   `abstained: true` **without calling the LLM**. `retrieval` itself keeps its minimum-1 behaviour so the
   «Поиск» tab and comparison metrics are unaffected.

## Consequences

- Every answerable RAG answer carries sources + verified quotes; the Control tab scores «с источниками и
  подтверждёнными цитатами: N / 10».
- The verdict vocabulary gains `abstained`; it never counts as `correct`, so a wrong abstention on an
  answerable question cannot inflate the scorecard. A separate 3-question out-of-corpus set exercises the
  abstain path.
- A wide-context option (`stitchSources`) folds neighbouring chunks of the same section into the prompt to
  counter the model «getting lost» — it adds `stitched: true` context chunks but does not change ranking.
- Cost: answers are longer (quotes), so `max_tokens` grew; the abstain path is cheaper (no LLM call).
