# ADR-0002: Agent store is split by concept, without a barrel

- Status: accepted
- Date: 2026-09-27
- Area: `src/features/agent/server/store`

## Context

`server/store.server.ts` was a pass-through barrel re-exporting 46 functions from six files, so its
interface was the union of every module. `store/sessions.server.ts` had grown into a 707-line module
owning eight tables (people, sessions, branches, messages, facts, summaries, memory). Callers could
not tell which capability lived where, and a single-file edit pulled the whole aggregate into view.

## Decision

Store modules are split by concept: `sessions`, `branches`, `messages`, `facts`, `memory`, `people`,
`tasks`, `invariants`, `profiles`, `agent-records`; `db.server.ts` holds the singleton, schema, seeds
and migrations. The `store.server.ts` barrel is deleted — callers import the concept module directly.
Cross-module reads (`branches`/`messages` use `getSession`) are explicit imports between concept
modules.

## Consequences

- Locality: a memory fix lives in `memory.server.ts`; branch forking in `branches.server.ts`.
- The interface a caller depends on is the concept module, not a 46-name surface.
- `deleteSession` still spans sibling tables by lifecycle; that is intentional and stays in
  `sessions.server.ts`.
- Store tests import the specific concept namespaces they exercise (`sessions` + `branches` + …).
