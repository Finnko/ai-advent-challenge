# Private LLM service

A standalone HTTP service that exposes the local MLX model as a private, rate-limited,
OpenAI-compatible API with a chat page. The model runs on the Mac (the "home server"); a Tailscale Funnel
makes the service reachable over the internet without opening ports. This is Day 30 — the deliberate step
from "run a model locally" to "let other people use it".

## Module map

- `entry.ts` — process entry: resolves config, loads the chat page, bridges `node:http` to the gateway
  (`Request`/`Response`), listens, stops on `SIGINT`/`SIGTERM`.
- `server/config.server.ts` — env resolution: keys, limits, port, model, usage log, chat page. `ServiceConfig`.
- `server/policy.server.ts` — `estimateMessagesTokens`/`estimateTextTokens` (`gpt-tokenizer`),
  `createRateLimiter` (token buckets per key + per IP) and `createSemaphore` (single-flight + bounded queue).
- `server/upstream.server.ts` — `createUpstream`: `chat` / `stream` / `status` over `@lib/local-llm.server`.
- `server/usage.server.ts` — `createUsageTracker`: in-memory per-key counters + append-only JSONL log.
- `server/gateway.server.ts` — `createGateway(deps).handle(request)`: routing, auth, validation, limits,
  OpenAI-shaped responses, SSE streaming. Fully injectable, so tests need no network.
- `web/index.html` — vanilla-JS chat page (streaming, mobile-friendly, key in `localStorage`).
- `tests/` — offline Vitest for config, policy (limiter/semaphore) and the gateway.
- `scripts/build-llm-service.mjs` — esbuild bundle + copy the chat page next to it.
- `scripts/llm-service-load.mjs` — `npm run llm-service:load`, the stability/limits probe.

## API

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/` `/chat` | — | chat page |
| GET | `/health` | — | upstream status + limits + concurrency |
| GET | `/stats` | key | per-key counters + concurrency |
| GET | `/v1/models` | key | the single served model |
| POST | `/v1/chat/completions` | key | `stream: true` → SSE |

Auth is `Authorization: Bearer <secret>`, `X-Api-Key: <secret>`, or `?key=<secret>` (for the one-time
chat-page link). Errors come back OpenAI-shaped (`{ error: { message, type, code } }`).

## Limits

- **Rate limit:** token buckets per key (`LLM_SERVICE_RPM`, `LLM_SERVICE_TOKENS_PER_MIN`) plus a coarse
  per-IP cap (`LLM_SERVICE_IP_RPM`). Over the limit → `429` with `Retry-After`.
- **Max context:** the API is stateless, so the client sends the full history; the gateway counts input
  tokens and rejects over `LLM_SERVICE_MAX_INPUT_TOKENS` with `413`. Output is capped by
  `LLM_SERVICE_MAX_OUTPUT_TOKENS`. No silent truncation.
- **Concurrency:** MLX handles one request at a time. A single-flight semaphore serializes work with a
  bounded queue (`LLM_SERVICE_QUEUE_DEPTH`, `LLM_SERVICE_QUEUE_WAIT_MS`); a full queue → `503` with
  `Retry-After`.

## Run

```bash
# 1) model backend (Mac, Apple Silicon)
mlx_lm.server --model mlx-community/Qwen3-8B-4bit

# 2) .env: LLM_SERVICE_KEYS=anna:secret1,boris:secret2   (and optional overrides)
npm run llm-service          # build + run dist/server/llm-service/llm-service.mjs
```

`LLM_SERVICE_MODEL` overrides the model (default `LOCAL_LLM_MODEL`, i.e. 8B). `LOCAL_LLM_BASE_URL` points
at the MLX endpoint. A different model on another port means a second `mlx_lm.server` instance.

## Publish to the internet

```bash
tailscale funnel 8088        # → https://<node>.ts.net, no open ports, HTTPS
```

Share the URL plus a key; a friend can open `https://<node>.ts.net/?key=<secret>` once, and the key is
remembered in their browser. The Cloudflare Tunnel alternative (`cloudflared`) is documented in ADR-0008.

## Keep it running (macOS)

See `deploy/llm-service.launchd.plist.example`. Copy it to `~/Library/LaunchAgents/`, adjust the paths,
then `launchctl load` it — the same idea as the systemd units on the VPS.

## Stability probe

```bash
LLM_SERVICE_URL=http://127.0.0.1:8088 LLM_SERVICE_LOAD_KEY=secret1 \
LOAD_REQUESTS=20 LOAD_CONCURRENCY=5 npm run llm-service:load
```

Prints success-rate, status distribution and p50/p95. Under the default limits, extra concurrent requests
show up as `429`/`503` — that is the limits working, not a failure.

## Testing offline

`tests/` injects a fake `Upstream`, `RateLimiter`, `Semaphore` and `UsageTracker`, so the gateway is
exercised without a model or network. Streaming is also covered at the transport level in
`src/lib/llm.stream.test.ts`.

## Decisions and porting

See [ADR-0008](../../../docs/adr/0008-local-llm-as-public-service.md) for the topology (Mac as home
server), the Tailscale Funnel choice, the transport-level `streamCompletions`, and why streaming is
allowed here. The feature never imports `features/local-llm`; it reaches the model through
`@lib/local-llm.server` only, like `features/telegram-quiz` and `features/rag`.
