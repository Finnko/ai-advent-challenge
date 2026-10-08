# Coding standards

Rules to write code against and to review a diff against. They cover style, tests and product scope;
architecture and navigation stay in `AGENTS.md`.

## Style

- Write no comments unless asked.
- Give each decision a small named function with early returns. Avoid nested ternaries (lint:
  `no-nested-ternary` and `curly`, see `.oxlintrc.json`) and long `if/else if` ladders; when a branch
  grows, extract it.

## Tests

- Tests live in `src/**/*.test.ts`, Vitest, node environment.
- Prefer offline tests through injection over real network/model calls. Testkits: the agent testkit is
  an in-memory `AgentStore`, the RAG testkit is an in-memory corpus plus a deterministic hash embedder,
  and agent tests inject a fake `AgentCapability` for RAG. Other seams: `WeatherSource`, `CorpusSource`,
  temp sqlite.
- Real-network tests run only under `RUN_NETWORK_TESTS=1`; real local-model tests under
  `RUN_MODEL_TESTS=1`.

## Product scope

- Respond one chunk at a time: no streaming. The UI shows a 3-dots animation while it waits.
- `people` has no real auth/backend yet — it is a seeded mock.
