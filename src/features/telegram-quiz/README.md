# Telegram quiz on a local LLM

A standalone Telegram bot (grammY, long polling) that generates multiple-choice quiz questions with the
local MLX model from Day 26. No cloud model: the only outbound call is to `api.telegram.org`.

## Module map

- `domain/types.ts` — `Difficulty`, `Topic`, `QuizQuestion`, `RoundState`, `RoundPhase`.
- `domain/question.ts` — zod schema + `parseQuestion`: extracts the first balanced `{…}` (fenced or
  wrapped in prose) and validates `{question, options[4], correctIndex, explanation}`; the four options
  must be distinct after normalization (rejects a degenerate MC where every option is the same string),
  and question/options/explanation allow only Cyrillic, Latin, digits, punctuation and spaces (rejects
  the CJK contamination small models leak into Russian text, e.g. `Дэвид芬奇`).
- `domain/round.ts` — pure round reducer: `createRound`, `withQuestion`, `submitAnswer`, `advance`,
  `extend`, `finish` (scoring lives here).
- `domain/store.ts` — `RoundStore`: `Map<chatId, RoundState>` with a lazy TTL purge. No grammY import.
- `data/topics.ts` — built-in topics and difficulty labels (client-safe text).
- `data/prompts.ts` — `buildQuestionPrompt`: asks for strict JSON. It deliberately does **not** include
  the already-asked questions: at low temperature that negative list makes the model echo the forbidden
  question instead of avoiding it.
- `server/generator.server.ts` — `createLocalQuestionGenerator`: calls `runLocalChat` at
  `GENERATOR_TEMPERATURE`, parses, and regenerates up to `GENERATOR_ATTEMPTS` times on invalid JSON,
  **a repeated question** (normalized match via `isDuplicateQuestion`) **or identical options**. Injected
  as `QuestionGenerator`.
- `server/config.server.ts` — `parseAllowedUserIds`; `resolveQuizEndpoint` builds the quiz's model
  endpoint from `QUIZ_LLM_MODEL` (falls back to `LOCAL_LLM_MODEL`), so the quiz can run a bigger local
  model than `/local-llm`.
- `server/bot.server.ts` — `createQuizBot(deps)`: allow-list middleware, commands, inline callbacks.
  Everything the bot needs (generator, store, status) is injected, so tests need no network.
- `bot/entry.ts` — process entry: reads env, starts long polling, stops on `SIGINT`/`SIGTERM`.
- `tests/` — offline Vitest: parser, reducer, store, and the bot via `bot.handleUpdate` + a mocked API
  transformer.

## How a round flows

`/quiz [тема]` checks the local server (`/models`), creates a round and generates question 1 with a
`typing` action. Each option is an inline button (`ans:<roundId>:<index>`); an answer edits the message
to show the verdict, the correct option and the explanation, plus a `next:<roundId>` button. The round
ends after `DEFAULT_ROUND_SIZE` questions with a summary and an `again:<roundId>` button; `/more` extends
by `EXTEND_SIZE`. Stale/duplicate taps are rejected by the round id and the round phase.

## Run

```bash
# quiz model (default 8B; set QUIZ_LLM_MODEL to a bigger one for better questions)
mlx_lm.server --model mlx-community/Qwen3-14B-4bit
# .env: TELEGRAM_BOT_TOKEN (from @BotFather), optional TELEGRAM_ALLOWED_USER_IDS
# .env: QUIZ_LLM_MODEL — quiz model; falls back to LOCAL_LLM_MODEL
npm run bot                                          # build + run dist/server/bot/telegram-quiz.mjs
```

`LOCAL_LLM_BASE_URL` / `LOCAL_LLM_MODEL` configure the shared endpoint; `QUIZ_LLM_MODEL` overrides the
model for the quiz only (the MLX server must be started with that model). A down local server produces a
friendly message instead of a crash.

## Testing offline

The bot is driven with `bot.handleUpdate(update)` and an injected `QuestionGenerator`/`RoundStore`; a
transformer installed with `bot.api.config.use` records calls instead of hitting Telegram. Two grammY
constraints bite: `handleUpdate` throws unless `bot.botInfo` is set directly (no `bot.init()`), and the
mocked updates must satisfy the types (`PrivateChat` needs `first_name`; `CallbackQuery` has no `chat`,
only `message.chat`). See `tests/bot-handlers.test.ts` for the working scaffolding.

## Decisions and porting

See [ADR-0006](../../../docs/adr/0006-telegram-quiz-bot.md) for why grammY + long polling, the esbuild
bundle, the in-memory store and the no-streaming choice. Local endpoint resolution and the `/models`
health check are shared via `@lib/local-llm.server` (`runLocalChat`, `getLocalLlmStatus`), so this
feature and `features/local-llm` never import each other.
