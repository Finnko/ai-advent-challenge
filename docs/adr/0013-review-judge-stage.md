# ADR-0013: judge stage in the pull-request review

- Status: accepted
- Date: 2026-10-15
- Area: `src/features/dev-assistant/{domain,server}`, `src/features/rag/server/answer-llm.server.ts`,
  `src/features/rag/server/local-llm.server.ts`
- Related: ADR-0005 (answer contract/abstention), ADR-0012 (Day-32 review pipeline)

## Context

The first real run of the Day-32 pipeline reviewed its own pull request and produced eight inline findings.
Checking each one against the code gave: one valid, one right conclusion reached through a wrong mechanism,
six false. The recurring shapes were:

- a claim about code the model never saw ("`REVIEW_STRATEGY` duplicates a string literal" — the module was
  not in the retrieved fragments and the file in fact imports the constant);
- a guess dressed as a bug (the `maxLines` budget, where the suggested "fix" would have been worse than the
  code);
- a finding that refutes itself ("the note is added even for findings without an anchor" — they are, by
  construction, exactly the ones without an anchor);
- an anchor that does not belong to its text (two findings on the same line, one missing its target by ~20
  lines).

The cause is structural, not stylistic: the prompt asked the model not to invent, but nothing obliged it to
*verify* a hypothesis against the evidence, and a model has no reason to doubt its own guess. The review is
advisory and never blocks a PR, but noise destroys the value: the author stops reading the findings.

## Decision

Add a second stage — the model as a verifier — between generating findings and delivering them:

```
reviewPullRequest (stage 1) → judgeFindings (stage 2) → splitFindings → delivery
```

1. **Input.** The judge receives the same `chunks` stage one retrieved (`review.sources`), the same
   `contextBlocks` (diff, changed-files list, typecheck output) and one extra block,
   `### Находки ревью (для проверки)`, with the numbered findings. No second retrieval, no second embedding.
2. **Contract.** `{"verdicts":[{"id":1,"keep":true,"reason":"…"}]}` where `id` is the 1-based position in
   the list it was given, `keep` is the decision and `severity` optionally lowers the severity.
3. **The judge never rewrites findings.** It selects and may lower severity; `message`, `suggestion`,
   `file` and `line` stay exactly as stage one produced them, so the deterministic anchor validation
   (`splitFindings`) keeps working and no text drifts away from its line.
4. **Silence is not rejection.** A finding without a verdict survives; the judge only rejects what it
   explicitly rejected.
5. **Fail-open.** A model error or an unparsable answer keeps every stage-one finding and notes "этап
   пропущен, находки не фильтровались" in the service block. The judge can never cost the PR its review.
6. **Transparency.** Rejected findings stay in the comment under `<details>Отклонено судьёй (N)</details>`
   with their reason, and the service block reports "оставил X из Y". This exposes both the judge's work
   and its own mistakes.
7. **Switch.** `PR_REVIEW_JUDGE=0` disables the stage; both stages otherwise share one generator.

## Consequences

- False findings no longer reach the pull request, and their reasons remain visible in the collapsed block —
  which is also the calibration surface for the stage-one prompt.
- The judge is cheaper than a second review: same fragments plus a short list of findings, and its answer is
  bounded by `JUDGE_MAX_TOKENS = 1500`.
- Cost: a second model call per PR (~+40 % of one review) and +30–60 s of run time; the 25-minute job
  timeout absorbs both.
- Cost: the judge can reject a valid finding — hence rejection is reported, not silently discarded.
- Boundary: the judge neither fixes anchors nor invents findings; anchoring stays stage one's job so that
  positional mistakes cannot re-enter the pipeline through the judge.
- The feature grew two domain modules (`review-judge-prompt.ts`, `review-verdict.ts`) and one server module
  (`review-judge.server.ts`); `features/rag` changed only in that `AnswerLlmOptions` gained an optional
  `maxTokens`, which the answer path ignores.

## Alternatives

- **One stage with a stricter prompt.** Cheaper, but does not address the root cause: the model still has no
  obligation to verify a claim against the context, and it never sees its own output as an object to check.
- **A separate judge model.** Would buy independence, but the project has one cloud transport
  (`callCompletions`) and one quality ceiling; the benefit does not cover the configuration cost.
- **Deterministic heuristics instead of a judge** (for example, dropping findings whose line is not in the
  diff). Cheap, but it only catches anchor misses and cannot separate an invented architectural claim from a
  real one — exactly the class that produced six of the eight false findings.
- **A judge that rewrites the findings.** Rejected: rewriting reintroduces anchor drift and makes
  `splitFindings` pointless.
