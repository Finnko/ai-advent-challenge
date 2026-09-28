# ADR-0001: MCP tool mutability travels as protocol annotations

- Status: accepted
- Date: 2026-09-27
- Area: `src/features/agent` (MCP)

## Context

The task-stage gate hides mutating tools during `planning` and blocks them on `act`. Previously the
host decided "is this tool mutating?" from a hardcoded set of names in `domain/agent-tools.ts`, while
the real tool names belonged to the spawned MCP servers (`mcp/*/register.ts`). Four modules had to
agree for the gate to hold, and a renamed MCP tool silently dropped out of the gate.

## Decision

Each MCP server declares its own tool metadata over the protocol with MCP tool annotations
(`annotations: { readOnlyHint }`). The host derives `descriptor.mutating` in
`server/mcp.server.ts` (`readOnlyHint !== true` → mutating, fail-closed) and `buildMcpAgentTools`
carries it onto `AgentTool.mutating`. `AgentTool.mutating` is the single source for the gate, for both
internal tools (from `ToolDefinition.mutating`) and MCP tools (from the annotation).

## Consequences

- One owner per tool: its server. Adding or renaming an MCP tool needs no host-side list edit.
- Fail-closed: an unannotated tool counts as mutating.
- Tests assert `descriptor.mutating` from a real `listMcpTools()` spawn (`tests/mcp.test.ts`), not a
  hardcoded name list.
- MCP bundles must be rebuilt (`npm run build:mcp`) after changing annotations; dev/test resolve
  `dist/server/mcp/*.mjs` when present.
