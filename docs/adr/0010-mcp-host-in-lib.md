# ADR-0010: MCP host machinery moved to `src/lib`

- Status: accepted
- Date: 2026-10-13
- Area: `src/lib/mcp/**`, `src/features/agent/{server/mcp*.server.ts,mcp/**}`, `src/features/dev-assistant/mcp/git/**`
- Related: ADR-0001 (tool metadata via annotations)

## Context

The MCP *host* — spawning a server over stdio, listing tools, deriving `mutating` from `readOnlyHint`,
calling tools — lived entirely inside `features/agent`. Day 31's developer assistant needs a git MCP
server, and reaching it through `features/agent` would create a feature-to-feature dependency the project
avoids. The same is true for the tiny server-side helpers (`serve`, `response`) every MCP server used.

## Decision

1. **Host machinery moves to `src/lib/mcp/`**: `client.server.ts` (spawn/client, tool listing, descriptor
   derivation, a small `callToolsFor` for batching), `registry.server.ts` (`createMcpRegistry` over
   per-feature `McpServerSpec`s), `types.ts`, plus `serve.ts` and `response.ts`.
2. **Specs and servers stay per feature.** `features/agent` declares its demo/jobs/research/market specs;
   `features/dev-assistant` declares the `git` spec. `features/agent` now consumes the lib host; the old
   host modules are gone. The `mutating` rule is unchanged and still fail-closed (ADR-0001 holds; this ADR
   references it, it does not rewrite it).
3. **Sandbox/annotation rules are preserved.** `@modelcontextprotocol/sdk` and `zod` still live only in
   server-only MCP modules and never reach the browser bundle.
4. **The git server is `dev-assistant`-only.** It is not registered in the agent's spec list, so `/agent`'s
   tool set is unchanged.
5. **Aliases work at runtime too.** MCP sources are `.ts` executed by Node in dev/tests, and Node ignores
   tsconfig paths. `scripts/mcp-alias-loader.mjs` (a `module.registerHooks` resolver, passed via
   `--import` only for `.ts` entries) teaches Node the same `@/`, `@lib/` and extensionless resolution the
   bundlers use; `scripts/build-mcp.mjs` got a matching esbuild `alias`. Compiled `.mjs` bundles need
   neither.

## Consequences

- Any feature can add an MCP server by declaring a spec and a server entry; the host is shared.
- The git server is reusable on Day 32 through the same host, without touching `features/agent`.
- Cost: moving the host touched every agent MCP server import; the full test suite (including the MCP
  spawn tests) passes, so the behaviour is unchanged.
