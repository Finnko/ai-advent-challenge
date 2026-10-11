# ADR-0007: Local LLM optimization lab — an OFAT sweep over a task profile

- Status: accepted
- Date: 2026-10-09
- Area: `src/features/llm-opt`

## Context

Day 29 asks to optimize the local model for one concrete task: tune sampling parameters and context window,
try quantization, and change the prompt template, comparing quality, speed and resource use before and
after. Days 26–28 already stand up the local model (`/local-llm`), a quiz generator and a local RAG
generator, and Day 28 already compares the local generator against the cloud one — but nothing sweeps
configurations of the local model itself, nothing measures memory, and no quantization is ever compared.

The repo needs a place that (a) holds a task with a deterministic quality metric, (b) varies prompt,
parameters and context one factor at a time, (c) stamps each run with the served model so quantization
sessions accumulate, and (d) measures the real resource use of a model that lives in a separate process.

## Decision

- **New self-contained feature** `src/features/llm-opt/` with route `/llm-opt`, dev/local-only, reaching
  the model only through `@lib/local-llm.server`. It imports neither `features/local-llm` nor `features/rag`
  nor `features/agent`. `/local-llm` stays a plain "run the model" showcase and does not grow an
  experiment.
- **Task profile seam.** The runner, quantization handling and memory sampling are task-agnostic; the task
  is data: `TaskProfile { fields, docs, prompts, contextFor }`. One profile ships today — structured
  extraction of `{founded_year, area_km2, federal_district}` from Russian city paragraphs.
- **Curated dataset, not the RAG corpus.** Wikipedia `explaintext` strips the infobox, so area and founding
  year are missing from many leads and the extractability is uneven. The 15 documents are therefore
  authored from the infobox values + leads (each with a `source` URL, CC BY-SA 4.0), which guarantees a
  clean, all-fields gold set. Each doc has a short `core` and an `extended` variant (extra real background
  as distractors) — that is the context-size axis.
- **OFAT, not a full grid.** One-factor-at-a-time around `B0 = (P0, t0, 256, lead, JSON)`: prompt,
  temperature, `max_tokens`, context, JSON mode. Repeats: 1 at `temperature = 0`, 3 otherwise. A full grid
  would burn hours on 18 GB for little extra signal.
- **Deterministic metric.** Normalized per-field equality (case/`ё`, whitespace, comma decimals, district
  canonicalization), plus full-JSON match and JSON-format rate. Winner: max accuracy → min latency → min
  memory. Raw misses stay visible in the inspector.
- **Memory via `footprint`.** MLX allocates through Metal, so `ps -o rss` reports ~0.8 GB for a loaded
  14B-4bit (~8.3 GB real). `server/resource.server.ts` samples `footprint <pid>` (macOS) with a `ps` RSS
  fallback, so the memory column is honest.
- **Results accumulate in a file.** Runs are upserted into
  `~/.ai-advent-challenge/llm-opt/results.json` keyed by `{model, config, doc, repeat}`; the panel labels
  sessions by the served model id and merges them, so the 4-bit and 6-bit sessions land in one table.
- **Quantization is a server property.** Build variants with `mlx_lm.convert` and restart the server; on an
  18 GB M3 Pro the compared points are 14B 4-bit, 14B 6-bit and the smaller 8B-4-bit. 14B bf16 (~30 GB)
  and 8-bit (~15 GB) do not fit reliably and are deliberately skipped.

## Consequences

- One more dev/local-only route; it is not part of `vite build`.
- Offline unit tests cover parsing, normalization, grading, aggregation and one mocked `runExtraction`;
  the real sweep is gated behind `RUN_MODEL_TESTS=1` and writes to the shared results file.
- The winning prompt + parameters are the profile default; the measured before/after table lives in the
  feature README. `features/rag`, the quiz and the agent are untouched.
