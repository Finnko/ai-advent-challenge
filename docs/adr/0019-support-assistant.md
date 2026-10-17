# ADR-0019: Неофициальный помощник Ozon на RAG + MCP

- Status: accepted
- Date: 2026-10-17
- Area: `src/features/support-assistant`, `src/lib/chunking`

## Context

Day 33 asks for a seller-support service over Ozon documentation: RAG over a mirrored knowledge base,
seller/ticket context through MCP, a public link, and honest abstention instead of invented marketplace
rules. The app already has an RAG engine facade (`@lib/rag-engine.server`), an MCP host
(`@lib/mcp/*`), a server route mechanism (`server.handlers`, used by `/jobs/tick`) and a Tailscale-only
VPS deploy. The markdown chunker, however, lives inside `features/dev-assistant`, and a second copy in a
new feature would make three consumers of the same 48–256-token structural split.

## Decision

- **Feature shape:** a standalone `src/features/support-assistant` importing only `@lib`. It does not
  import `features/rag` or `features/dev-assistant`.
- **Corpus:** `Livingbeside/mp-docs-mirror` (`ozon/kb` + `ozon/api/seller/guides`), fetched into a
  gitignored `.cache/ozon-corpus` by `scripts/fetch-ozon-corpus.mjs`. The index is built locally and the
  SQLite file is shipped to the VPS; the VPS does not need the corpus. `kind: section` pages are skipped;
  `updated` is folded into the chunk title rather than the body.
- **Index:** a private `support` strategy in its own `support.sqlite`; e5-base embeddings; `k = 6`, no
  reranker, no rewrite.
- **Retrieval plus context:** one MCP session per request for seller, ticket, finance, postings and
  product; the context is a plain text block capped at 6000 characters. The answer goes through
  `answerFromSources` with `SUPPORT_PERSONA`.
- **Abstention beats context:** `contextRescues: false`. Ticket context is supplementary; a weak
  retrieval still abstains. This keeps a clearly out-of-corpus question (for example, the weather) honest
  even when a ticket is selected.
- **MCP:** `support-mcp-ozon`, stdio, seven read-only tools, fixtures only, sandboxed. API keys are stored
  as masked `last4` + expiry and never sent in full.
- **Public edge:** a real server path (`/support`, `/api/support/*`) instead of `createServerFn`, so the
  second instance can allowlist paths. `SUPPORT_PUBLIC=1` returns 404 for everything else. The private
  instance stays on `serve --https=8443`; the public one is `funnel --https=443` on port 3001.
- **Limits:** 30 requests/hour per IP, 60/hour globally, 200/day, single-flight with a queue of 2, 4 KB
  body, 800-character question, 45-second model timeout through the transport `AbortSignal`. The limiter
  trusts only `X-Forwarded-For`: a live Tailscale Funnel check showed it overwrites client-supplied XFF
  with the real public IP, while `X-Real-IP` passes through untouched.
- **Shared chunker:** `src/lib/chunking/markdown.server.ts` exposes
  `createMarkdownChunker({ id, minTokens?, maxTokens? })`, `parseMarkdownSections` and the 48/256
  constants. Dev-assistant (`markdown`), PR review (`review`) and support (`support`) use the same
  factory; the structural engine stays in `features/rag` and is reached through `@lib/rag-engine.server`.
- **Markdown UI:** `react-markdown` without plugins, no raw HTML, links opened with
  `rel="noreferrer noopener"`; typography comes from `@tailwindcss/typography`.

## Consequences

- `features/dev-assistant/server/markdown-chunker.server.ts` and its test are gone; behavior is preserved
  by the shared factory and the moved test. The feature README and `AGENTS.md` describe the new seam.
- The transport gained `signal` in `CallCompletionsOptions`, and `AnswerLlmOptions` forwards it to both
  cloud and local answer paths. Other consumers keep the old behavior when no signal is passed.
- The public instance runs the full app bundle but only serves `/support` and its API; code for other
  pages remains fetchable under `/assets/*` by design. This is acceptable for a demo.
- `support.sqlite` is a deploy artifact. The deploy fails if the local file is missing; health exposes
  chunk count and model metadata, and the first start warms the embedder. Public DNS propagation for
  Funnel can lag up to 10 minutes, so external checks are advisory.
- Fixtures are synthetic; the footer explicitly says the service is unofficial and does not write to
  tickets.
