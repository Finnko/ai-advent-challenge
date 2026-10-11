# Feature: LLM optimization lab

A self-contained stand for optimizing a **local** model on one concrete task. It is dev/local-only, reaches
the model only through the shared `@lib/local-llm.server` (`runLocalChat` / `getLocalLlmStatus`), and never
imports `features/local-llm`, `features/rag` or `features/agent`. Public surface — the `/llm-opt` screen
(`pages/LlmOptPage`).

## Task profile

The task is structured extraction: from a Russian city paragraph the model must return a strict JSON

```json
{ "founded_year": 1147, "area_km2": 2561.5, "federal_district": "Центральный" }
```

15 cities (`data/dataset.ts`). Each document has a short `core` paragraph (all three facts) and an
`extended` one that appends real background sentences as distractors — this is the "context size" axis.
Texts are curated from Wikipedia (infobox values + leads), each with a `source` URL; the underlying
articles are CC BY-SA 4.0.

## Module map

- `types.ts` — wire re-exports.
- `data/dataset.ts` — the 15 documents + gold values.
- `data/prompts.ts` — three prompt variants (P0 minimal, P1 schema, P2 schema + few-shot) and
  `buildPromptMessages`.
- `data/configs.ts` — `ExperimentConfig`, the OFAT `SWEEP_CONFIGS`, `resolveConfig`.
- `data/profile.ts` — the task-profile seam (`fields`, `docs`, `prompts`, `contextFor`). One profile today;
  the runner, quantization and memory sampling are task-agnostic.
- `domain/extraction.ts` — `parseExtraction` (first balanced `{…}`, fenced JSON, number coercion).
- `domain/metric.ts` — normalization (case/space/units, comma decimals), `gradeExtraction`.
- `domain/results.ts` — `StoredRun`, `summarizeRuns`, `pickWinner`.
- `server/run.server.ts` — `runExtraction(config, docId, repeat)` → one `StoredRun`.
- `server/resource.server.ts` — `sampleMlxMemoryMb()`: `footprint` of the `mlx_lm.server` process, `ps`
  fallback. MLX allocates through Metal, so RSS misses most memory; `footprint` is the honest number.
- `server/results.server.ts` — accumulates runs in `~/.ai-advent-challenge/llm-opt/results.json` (0600),
  keyed by `{model, config, doc, repeat}` so quantization sessions merge.
- `functions/` — thin `createServerFn` adapters (`run`, `results`, `status`) + `validation.ts`.
- `api/use-llm-opt.ts` — status, runs, reset and the client-side sequential `useSweepRun`.
- `pages/LlmOptPage.tsx` + `components/` — sweep controls, results table, per-run inspector.

Layers: `pages` → `api` → `functions` → `server`/`domain`.

## Experiment

One-factor-at-a-time around the baseline `B0 = (P0, t0, 256, lead, JSON)`: prompt (`P0/P1/P2`),
`temperature` (`0 / 0.3 / 0.7`), `max_tokens` (`256 / 512`), context (`lead / extended`), JSON mode off.
Repeats: 1 at `temperature = 0`, 3 otherwise (stability). The full set is `SWEEP_CONFIGS`.

Quantization is a **server** property, not a request one. Build a variant with
`mlx_lm.convert`, restart `mlx_lm.server` with it, and mark the session by its model id (set
`LOCAL_LLM_MODEL` to that id so runs are labelled correctly):

```bash
.local-llm-venv/bin/mlx_lm.convert --hf-path mlx-community/Qwen3-14B-4bit -q --q-bits 6 \
  --mlx-path ~/models/qwen3-14b-6bit
.local-llm-venv/bin/mlx_lm.server --model ~/models/qwen3-14b-6bit --port 8080
```

On an 18 GB M3 Pro, 14B bf16 (~30 GB) and 8-bit (~15 GB) do not fit reliably; the compared points are 14B
4-bit, 14B 6-bit and the smaller 8B-4-bit.

## Metric

Per field: normalized equality (case- and `ё`-insensitive, whitespace collapsed, comma decimals, district
canonicalized to its federal-okrug name). A run reports `score` (correct fields / 3) and `valid` (all
correct). A group reports per-field accuracy, overall accuracy, full-JSON-match rate, JSON-format rate,
average latency, tokens/s and peak memory. Winner rule: max overall accuracy → min average latency → min
peak memory.

## Run

```bash
# 1. local model (14B-4bit is the project default for local generation)
.local-llm-venv/bin/mlx_lm.server --model mlx-community/Qwen3-14B-4bit --port 8080

# 2. the lab
npm run dev                       # http://localhost:3000/llm-opt

# or the headless sweep (persists to the same results file)
RUN_MODEL_TESTS=1 LOCAL_LLM_MODEL=mlx-community/Qwen3-14B-4bit \
  npx vitest run src/features/llm-opt/tests/sweep.integration.test.ts
# narrow it with LLM_OPT_SWEEP=<config ids> LLM_OPT_DOCS=<doc ids>
```

## Results

Measured on an Apple M3 Pro (18 GB) with MLX, 15 documents. `temperature` is the only stochastic axis, so
those configs run three repeats (45 samples); the rest are single runs (15). "Accuracy" is the mean over
the three fields; "full JSON" is the share of documents with a complete, correct object.

### Qwen3-14B-4bit · 8.3 GB on disk

| configuration | accuracy | full JSON | latency | tok/s | memory |
| --- | --- | --- | --- | --- | --- |
| t0.7 · P1 | 100% | 100% | 3.1 s | 13.1 | 9.0 GB |
| t0.3 · P1 | 100% | 100% | 3.1 s | 13.0 | 9.0 GB |
| P2 · schema + example | 100% | 100% | 3.3 s | 10.5 | 8.9 GB |
| max_tokens 512 · P1 | 100% | 100% | 3.6 s | 11.1 | 8.8 GB |
| JSON mode off · P1 | 100% | 100% | 3.8 s | 10.6 | 8.7 GB |
| P1 · schema (default) | 100% | 100% | 3.8 s | 10.6 | 8.7 GB |
| context: extended · P1 | 100% | 100% | 4.2 s | 9.5 | 8.7 GB |
| baseline P0 · t0 · 256 · lead · JSON | 0% | 0% | 3.7 s | 12.9 | 8.9 GB |

### Qwen3-14B-6bit · 11.2 GB on disk

| configuration | accuracy | full JSON | latency | tok/s | memory |
| --- | --- | --- | --- | --- | --- |
| t0.7 · P1 | 100% | 100% | 4.3 s | 9.4 | 12.0 GB |
| t0.3 · P1 | 100% | 100% | 4.3 s | 9.4 | 12.0 GB |
| P2 · schema + example | 100% | 100% | 4.4 s | 7.9 | 12.0 GB |
| max_tokens 512 · P1 | 100% | 100% | 4.7 s | 8.4 | 12.0 GB |
| JSON mode off · P1 | 100% | 100% | 4.8 s | 8.3 | 12.0 GB |
| P1 · schema (default) | 100% | 100% | 5.0 s | 7.9 | 12.0 GB |
| context: extended · P1 | 100% | 100% | 5.3 s | 7.5 | 12.0 GB |
| baseline P0 · t0 · 256 · lead · JSON | 0% | 0% | 7.0 s | 7.5 | 12.0 GB |

### Qwen3-8B-4bit · 4.3 GB on disk

| configuration | accuracy | full JSON | latency | tok/s | memory |
| --- | --- | --- | --- | --- | --- |
| t0.3 · P1 | 100% | 100% | 1.7 s | 23.1 | 5.6 GB |
| P2 · schema + example | 100% | 100% | 1.7 s | 20.0 | 5.4 GB |
| t0.7 · P1 | 100% | 100% | 1.8 s | 22.8 | 5.6 GB |
| JSON mode off · P1 | 100% | 100% | 1.9 s | 20.7 | 5.3 GB |
| P1 · schema (default) | 100% | 100% | 1.9 s | 20.6 | 5.3 GB |
| max_tokens 512 · P1 | 100% | 100% | 2.0 s | 19.8 | 5.4 GB |
| context: extended · P1 | 100% | 100% | 2.2 s | 17.8 | 5.3 GB |
| baseline P0 · t0 · 256 · lead · JSON | 0% | 0% | 2.4 s | 21.4 | 5.1 GB |

### Quantization (config P1 · t0 · 256 · lead)

| model | on disk | accuracy | full JSON | latency | tok/s | memory |
| --- | --- | --- | --- | --- | --- | --- |
| mlx-community/Qwen3-14B-4bit | 8.3 GB | 100% | 100% | 3.8 s | 10.6 | 8.7 GB |
| mlx-community/Qwen3-14B-6bit | 11.2 GB | 100% | 100% | 5.0 s | 7.9 | 12.0 GB |
| mlx-community/Qwen3-8B-4bit | 4.3 GB | 100% | 100% | 1.9 s | 20.6 | 5.3 GB |

### What this says

- **The prompt schema is the whole quality story.** The minimal P0 returns JSON with Russian keys
  (`год_основания`, …): 0% on every model. Spelling out the field names, units and allowed districts (P1)
  takes all three models to 100%; the few-shot example (P2) adds nothing but tokens.
- **Sampling parameters do not move quality here.** `temperature` 0/0.3/0.7, `max_tokens` 256/512, the
  JSON response mode and the (distractor-laden) extended context all stay at 100% — they only trade
  latency and tokens. The extended context is the clearest cost: +0.4/+0.3/+0.3 s for no gain.
- **Quantization is a speed/memory trade, not a quality one at this size.** 6-bit costs ~35% more memory
  and ~30% more latency than 4-bit for the same 100%; the smaller 8B-4bit is ~2× faster and ~40% lighter
  at 100% accuracy — the efficient choice for this task.
- **Profile default:** P1 schema, `temperature` 0, 256 tokens, lead context, JSON mode (`DEFAULT_CONFIG_ID`).

Practical default for this task: **8B-4bit + P1** — 100% accuracy at 1.9 s / 5.3 GB, versus 3.8 s / 8.7 GB
for 14B-4bit and 5.0 s / 12.0 GB for 14B-6bit. 8-bit and bf16 for 14B are skipped: they do not fit 18 GB
reliably.

## Porting

1. Copy `src/features/llm-opt/`.
2. External deps: react-query, React, TanStack Start; local model via an OpenAI-compatible endpoint
   (`LOCAL_LLM_BASE_URL` / `LOCAL_LLM_MODEL`).
3. Register the `/llm-opt` route and (optionally) a sidebar entry.
4. Swap the task profile: `data/dataset.ts` (docs + gold), `data/prompts.ts`, `domain/metric.ts`.
5. `npm run test` for the offline unit tests; the sweep needs `RUN_MODEL_TESTS=1` and a live server.
