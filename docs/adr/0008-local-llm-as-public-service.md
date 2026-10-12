# ADR-0008: The local LLM is exposed as a private HTTP service via Tailscale Funnel

- Status: accepted
- Date: 2026-10-11
- Area: `src/features/llm-service`

## Context

Day 30 asks to run the local LLM as a service: reachable over HTTP, usable as a chat, and protected by
basic limits (rate limit / max context), with the explicit goal of giving **other people** access from
the internet (the challenge discussion recommends a public URL, not just a tailnet).

Everything before Day 30 deliberately keeps the local MLX model out of production: `features/local-llm`
is dev/local-only, the deploy is Tailscale-only (`deploy/`), and no port is open to the internet. The
model itself only runs on Apple Silicon (`mlx_lm.server`), while the VPS is a CPU box. The shared
transport `callCompletions` lives in `src/lib/llm.server.ts` and is intentionally non-streaming.

Day 30 therefore needs decisions about where the service runs, how it becomes public, and how limits are
enforced.

## Decision

- **Topology:** the Mac is the "home server". `mlx_lm.server` stays the model backend and the new gateway
  runs next to it. The existing Tailscale-only VPS deploy is not touched.
- **Feature shape:** a standalone feature `src/features/llm-service/` (like `features/telegram-quiz`): a
  Node HTTP process bundled with esbuild (`scripts/build-llm-service.mjs` →
  `dist/server/llm-service/llm-service.mjs`), outside `vite build`. It reaches the model only through
  `@lib/local-llm.server` (`runLocalChat`, `streamLocalChat`, `getLocalLlmStatus`) — never via
  `features/local-llm`.
- **Public edge:** Tailscale Funnel gives a public `https://<node>.ts.net` URL with no open ports and no
  domain. Cloudflare Tunnel is the documented alternative.
- **API:** OpenAI-compatible `GET /v1/models` and `POST /v1/chat/completions` (with SSE `stream`), plus
  `GET /health` (public) and `GET /stats`. So any OpenAI-compatible client works; the feature also ships a
  small vanilla-JS chat page.
- **Auth:** named bearer keys (`LLM_SERVICE_KEYS="name:secret,…"`). The chat page keeps the key in
  `localStorage` and accepts a one-time `?key=`/`#key=` link so a phone never retypes it. No key → 401.
- **Rate limit:** in-process token buckets, per key (`LLM_SERVICE_RPM`, `LLM_SERVICE_TOKENS_PER_MIN`) and
  a coarse per-IP cap (`LLM_SERVICE_IP_RPM`). Over the limit → `429` + `Retry-After`.
- **Max context:** the API is stateless (the client sends the whole history); the gateway counts input
  tokens with `gpt-tokenizer` and rejects over `LLM_SERVICE_MAX_INPUT_TOKENS` with `413` (no silent
  truncation). Output is capped by `LLM_SERVICE_MAX_OUTPUT_TOKENS`.
- **Concurrency:** MLX serves one request at a time, so a single-flight semaphore with a bounded queue
  (`LLM_SERVICE_QUEUE_DEPTH`) serializes work; overflow → `503` + `Retry-After`. This makes "stability
  under several requests" observable instead of undefined.
- **Streaming:** SSE is used for chat. Because the raw `fetch` must stay centralized, `streamCompletions`
  is added next to `callCompletions` in the shared transport, and `streamLocalChat` next to `runLocalChat`
  in `@lib/local-llm.server`; the gateway only passes the SSE stream through.
- **Supervision:** a `launchd` agent on the Mac (`deploy/llm-service.launchd.plist.example`) mirrors the
  systemd units used on the VPS.
- **Observability:** `GET /health` (upstream status + limits), `GET /stats` (per-key counters), and a
  JSONL usage log (default `~/.ai-advent-challenge/llm-service/usage.jsonl`).

## Consequences

- Day 30 intentionally relaxes two earlier rules for this feature only: the local LLM is no longer
  strictly "dev/local-only" (it is the backend of an exported service) and streaming is allowed (see
  `CODING_STANDARDS.md`). `features/local-llm` stays the dev-only client.
- The transport gained a streaming sibling; `callCompletions` behavior is unchanged and still covered by
  `src/lib/llm.server.test.ts`.
- Security rests on bearer keys plus rate limits over a public URL. Keys are shared secrets: rotate by
  editing `LLM_SERVICE_KEYS`. There is no TLS termination in the process — Tailscale Funnel / Cloudflare
  provide HTTPS.
- Offline tests drive the gateway with an injected `Upstream`/`RateLimiter`/`Semaphore`/`UsageTracker`; no
  model or network is needed. Real stability is measured with `npm run llm-service:load` against the
  running service.
