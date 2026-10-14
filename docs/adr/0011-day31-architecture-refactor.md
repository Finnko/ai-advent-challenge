# ADR-0011: Day-31 architecture refactor — deep search/answer seams, structured MCP output, no `lib` → feature imports

- Status: accepted
- Date: 2026-10-14
- Area: `src/lib/{rag-engine.*,source-format,mcp/**,agent-rag.server}`, `src/features/rag/{domain,server}`,
  `src/features/agent/server`, `src/features/dev-assistant/**`
- Related: ADR-0005 (answer contract/abstention), ADR-0009 (shared RAG engine), ADR-0010 (MCP host in `lib`)

## Context

Day 31 produced the developer assistant on top of two seams created the same day: the RAG facade
(`rag-engine.server.ts`) and the MCP host in `src/lib/mcp`. A review of that code found five kinds of
friction, all in the newest code:

1. `src/lib` imported one feature: `lib/git-context.server.ts` read
   `features/dev-assistant/server/mcp-registry.server`, creating a module-level cycle and breaking the
   "features never import each other; `lib` composes" rule from the other side.
2. The RAG facade was a barrel of ~20 re-exports with one 3-line function. Every consumer
   (`agent-rag.server.ts`, dev-assistant `core.server.ts`, the `/rag` paths) assembled its own
   `retrieve` options and re-decided the relevance policy: which score to read, which threshold to
   compare against, whether the result is good enough to answer from.
3. `/rag`'s answer path and dev-assistant's core repeated the same "sources → answer" steps
   (abstention gate → messages → LLM → `parseAnswerResponse` → `verifyQuotes`), and the numbered-fragment
   renderer existed in four near-identical copies.
4. The markdown chunker duplicated the wiki structural chunker except for one heading regex, while
   `ChunkingStrategy.id` was decorative: the id was hardcoded inside `chunk()` and a third copy lived in
   `buildIndex`'s `options.strategy`.
5. The git MCP server and host exchanged human-readable Russian prose; `collectGitContext` recovered the
   branch with `replace(/^Текущая ветка:\s*/, '')`, so any wording change on the server side silently
   broke the client. The git spec also hardcoded tool names in two places, and spec paths were resolved
   relative to the registry file while compiled paths resolved from `process.cwd()`.

## Decision

1. **`src/lib` composes features, it does not depend on one.** Only the app-level composition modules
   (`agent-rag.server.ts`, `rag-engine.{server,types}.ts`) may import `features/*`; the rest of `lib` is
   feature-agnostic. The git-specific context collection therefore moves into
   `features/dev-assistant/server/git-context.server.ts` (calls, section titles, `GitContext` shape);
   `src/lib/mcp/context.server.ts` becomes a generic collector over an MCP config and a caller-supplied
   call list, with an injectable runner and a short in-flight/TTL cache so a panel and the answer it
   belongs to share one spawn. `GitContext`/`GitContextSection` move to
   `features/dev-assistant/domain/git/context.ts`.
2. **One deep search seam: Область поиска.** `features/rag/server/search.server.ts` (`searchSources`)
   takes a `SearchScope` (strategy, k, rerank, rewrite, stitch, candidateK), a query and a store, resolves
   the default embedder/reranker/rewriter, and returns `SourcesOutcome`: sources plus `reranked`,
   `confidence`, the effective `threshold`, and `weak` ("not enough to answer from the documents").
   `runPipeline` stays the mechanism layer below it; `/rag`'s search, `/rag`'s answer, the agent
   capability and dev-assistant all go through `searchSources`.
3. **One deep answer seam.** `features/rag/server/source-answer.server.ts` (`answerFromSources`) owns the
   abstention gate, the message assembly, the model call, JSON parsing and quote verification against the
   chunks that were actually sent. Each consumer supplies an `AnswerPersona` (`domain/answer-persona.ts`:
   system prompt, fragments heading, optional context heading, `contextRescues`, `json`, abstain text).
   `/rag`'s `answer.server.ts` and dev-assistant's `core.server.ts` become thin adapters; the agent keeps
   its own decision loop and consumes only sources. `agent-rag.server.ts` still maps `ScoredChunk` to
   `RetrievedSource`: that adapter sits on the Способность seam, which has two implementations (the real
   capability and the test fake), so the seam is real.
4. **The RAG facade shrinks to the seams.** `rag-engine.server.ts` re-exports `searchSources`,
   `answerFromSources`, index building, the store, `resolveAnswerLlm` (the single local/cloud switch,
   previously duplicated in `runtime.server.ts`) and the structural chunker; `retrieve`/`stitchSources`/
   `runPipeline`/`parseAnswerResponse` stop being public. The root cause of a missing index is shared:
   `EmptyIndexError` + `assertIndexBuilt(store, strategy)`.
5. **One structural chunker, parameterised.** `createStructuralChunker({ id, parseSections, minTokens,
   maxTokens })` holds the grouping/windowing algorithm; `domain/sections.ts` holds one heading-driven
   parser plus the wiki and markdown heading rules. `ChunkingStrategyId` becomes an open string (the id is
   set once, in the factory, and flows into `Chunk.strategy` and `chunkId`), while the shared picker keeps
   its closed set as `RagChunkingStrategyId` (`fixed | structural`). The dev-assistant chunker uses
   `id: 'markdown'` and stays unregistered, so isolation no longer depends on the two indexes living in
   different files.
6. **Structured MCP output, with prose kept.** MCP tools may declare `outputSchema` and return
   `structuredContent` next to the human-readable text; the host surfaces it as
   `McpCallResult.structured` and falls back to text when a server does not provide it. The git tools
   declare schemas and return both, so consumers read fields instead of parsing prose. Spec paths are
   resolved from one anchor (`process.cwd()`), like compiled entries.
7. **Dead weight removed.** `features/agent/server/mcp.server.ts` (a pass-through of the `lib` host),
   `resolveMcpEntry`, `findAgentCapability` and `McpHost.callTool` (a per-call search across all servers,
   used only by a test) are gone; agent consumers import the host from `@lib/mcp` and bind their registry
   themselves, exactly as dev-assistant does.
8. **The interface is the test surface.** New offline tests call the deepened modules through their public
   interfaces: `search.test.ts` (scope → threshold choice, `weak`, stitch on request), the dev-assistant
   persona tests (`answerFromSources` with a fake `AnswerLlm`) and `lib/mcp/context.test.ts` (mapping,
   degradation, single-flight cache) with an injected runner instead of a real spawn.

## Consequences

- `src/lib` is feature-agnostic again, and both seams (`agent-rag.server.ts`, `rag-engine.server.ts`) are
  app-level composition, not new dependencies of the features.
- Adding a second corpus is a scope plus a chunker: dev-assistant needed no engine changes to switch to
  `id: 'markdown'`.
- Policy that used to be re-decided per consumer (threshold selection, abstention input, quote
  verification target, chunk id) now has one home each; the facade's public surface shrank by roughly
  half.
- Cost: `features/rag` absorbed the new seams, so ADR-0009's "not restructured" note no longer holds
  verbatim (this ADR amends it in that respect; the facade and the isolation rules stand).
- Cost: the empty-index message is now generic (`Индекс «…» ещё не собран`), and a dev-assistant index
  built under the old `structural` id must be rebuilt once under `markdown`.
- ADR-0001 (metadata via annotations) and ADR-0010 (host in `lib`) are unchanged in substance: the host
  still derives `mutating` fail-closed, and the specs still live per feature.
