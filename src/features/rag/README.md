# Feature: RAG

Индексация документов: корпус статей Википедии о городах России → разбиение на чанки двумя
стратегиями → эмбеддинги → локальный SQLite-индекс (метаданные + векторы) → top-k поиск →
сравнение стратегий по структуре и качеству поиска.

Фича самодостаточна и спроектирована под перенос в другой TanStack Start проект. Публичная
поверхность — экран `/rag` (`pages/RagPage`).

## Структура

```
src/features/rag/
  pages/         # RagPage — табы Индекс / Поиск / Ответ / Контроль / Сравнение
  api/           # react-query: use-rag-index, use-rag-search, use-rag-corpus, use-rag-chunks,
                 # use-rag-answer, use-control-run, use-abstain-run
  functions/     # createServerFn-адаптеры: build-index, search, answer, get-index-stats, get-comparison,
                 # list-corpus, list-chunks + validation.ts
  server/        # *.server.ts: corpus, embedder, index-store, indexing, retrieval, reranker, rewrite,
                 # answer-llm, comparison, answer, rag
  domain/        # изоморфно, без env/fetch: chunking/{fixed,structural,registry,windows,types}, corpus,
                 # embedder (шов + hash-эмбеддер), reranker (шов + lexical), pipelines, rewrite-prompt,
                 # wikipedia (парсер заголовков), metrics, answer-prompt, answer-format, answer-eval, types
  data/          # cities (15 городов), corpus (снапшот 15 статей), eval-queries (16 вопросов),
                 # control-questions (10 контрольных), abstain-questions (3 вне корпуса), rag-ui (подписи)
  components/    # IndexPanel, SearchPanel, AnswerPanel, ControlPanel, AnswerCard, ComparisonPanel, ChunkBrowser
  tests/         # офлайн-тесты + gated интеграционные
  types.ts       # wire-типы ответов API
  shared/        # resolveStorePath (пути к БД)
```

Слои: `pages` → `api` → `functions` (`createServerFn`) → `server`/`domain`.

## Корпус

- 15 городов РФ (`data/cities.ts`): Москва … Волгоград.
- Источник — MediaWiki API ru.wikipedia.org (`action=query&prop=extracts&explaintext=1&redirects=1`),
  полный plaintext статьи (≈50–140k символов на статью).
- `server/corpus.server.ts` (`CorpusSource`): `list()` + `load(ref)`. Порядок источников при `load`:
  файловый кеш `RAG_CORPUS_DIR` → встроенный снапшот `data/corpus/<id>.txt` → сеть. Снапшот
  собран заранее (offline-first, без 429); сеть нужна только для городов вне снапшота или при
  сброшенном кеше. Скачанный текст кешируется файлом `<id>.txt` в `RAG_CORPUS_DIR`
  (по умолчанию `~/.ai-advent-challenge/rag-corpus`). В тестах подставляется фейковый `fetch`.
- Сетевой путь уважает лимиты Викимедиа (2026): User-Agent с контактом (`RAG_WIKI_CONTACT`),
  ретрай на `429`/`503` по заголовку `Retry-After`, загрузка с конкурентностью ≤ 3.
- Текст снапшота — CC BY-SA 4.0 (Wikimedia); на каждую статью хранится `source`-URL.

## Chunking

Обе стратегии возвращают один тип `Chunk` (метаданные ниже) и лежат в реестре
`domain/chunking/registry.ts`.

- **fixed** (`fixed.ts`): окно по токенам через `gpt-tokenizer`, 256 токенов, перекрытие 32.
  `section` — ближайший предшествующий заголовок, `crossesSection` — разошлись ли начало и конец
  чанка по разделам.
- **structural** (`structural.ts`): разбиение по заголовкам `== … ==` (`domain/wikipedia.ts`),
  секции > 256 токенов нарезаются по токенам, мелкие подразделы (< 48 токенов) склеиваются с
  родительским.

`domain/wikipedia.ts` строит секции с путём (`Статья > Раздел > Подраздел`), уровнями и
char-офсетами; `domain/chunking/windows.ts` — общий токенный нарезчик и сборка `Chunk`.

Метаданные чанка: `chunk_id, strategy, doc_id, source, title, section, section_path, position,
char_start, char_end, n_tokens, crosses_section, text`.

## Эмбеддинги

- Шов `domain/embedder.ts`: `Embedder { id, dim, embed(texts, kind: 'query'|'passage') }`, косинус
  через скалярное произведение нормированных векторов.
- `server/embedder.server.ts`: локальный ONNX-эмбеддер `@huggingface/transformers`
  (по умолчанию `Xenova/multilingual-e5-base`, 768 dim, CPU, после разовой загрузки модели — офлайн).
  E5 требует префиксы `query:`/`passage:` и mean-пулинг; `bge-m3` — `cls` без префиксов (детект по id).
  Провайдер `hf` (сырой `fetch` к `router.huggingface.co/v1/embeddings`) — опция через
  `RAG_EMBED_PROVIDER=hf`.
- Офлайн-тесты и демо используют детерминированный `createHashEmbedder` (лексический хеш) —
  без сети и модели.

## Индекс

- `server/index-store.server.ts`, `node:sqlite` (динамический импорт) в `RAG_DB_PATH`
  (по умолчанию `~/.ai-advent-challenge/rag.sqlite`, права `0600`).
- Таблицы: `rag_documents` (title, source, char/n_tokens), `rag_chunks` (все метаданные +
  `embedding BLOB` Float32 + `dim`/`model`), `rag_meta` (`<strategy>.built_at|model|chunks|dim`).
- Обе стратегии лежат в одной таблице с колонкой `strategy` — сравнение это `WHERE strategy = ?`.
- `server/indexing.server.ts` (`buildIndex`): load → chunk → батчевые эмбеддинги (passage) →
  `replaceIndex` (delete стратегии + upsert документов + insert чанков в транзакции).
- `server/retrieval.server.ts` (`retrieve`/`searchChunks`): эмбеддинг запроса (query) → brute-force
  косинус по сохранённым векторам → пул кандидатов `candidateK` → опциональный реранк → порог
  отсечения (гарантированный минимум 1) → top-k.

## Реранкинг и rewrite (Day 23)

После первого этапа (косинус top-`candidateK`) добавляется второй этап: **cross-encoder реранкер** и
**порог отсечения** нерелевантного. Плюс опциональная **переформулировка запроса** (query rewrite).

- Шов `domain/reranker.ts`: `Reranker { id, rerank({ query, documents }) → number[] }` —
  вероятности релевантности 0..1. `sigmoid` — нормировка логитов; `createLexicalReranker` —
  детерминированный оффлайн-реранкер (лексическое пересечение) для тестов и демо.
- `server/reranker.server.ts`: локальный ONNX cross-encoder
  (`onnx-community/bge-reranker-v2-m3-ONNX` по умолчанию — мультиязычный, `q8`, CPU). Модель
  кэшируется по `${model}:${dtype}`, логит проходит через сигмоиду, **fail-open**: при ошибке
  загрузки/инференса ранжирование откатывается к косинусу (`reranked: false`), приложение остаётся
  рабочим оффлайн.
- Пайплайны (`domain/pipelines.ts`) — именованные пресеты: `rag`, `rag+rerank`, `rag+rewrite`,
  `rag+rewrite+rerank`. Внутри — флаги `{ rewrite, rerank, threshold }`; `DEFAULT_RERANK_THRESHOLD`
  = 0.5, `DEFAULT_RERANK_MARGIN` = 0.1, `COSINE_TIE_EPSILON` = 1e-6.
- `server/rewrite.server.ts`: LLM-переформулировка через шов `AnswerLlm` (deepseek-flash, JSON
  `{"rewritten": "..."}`). Эмбеддинг считается по переформулированному запросу, а реранк — по
  исходному. Промпт и разбор — в `domain/rewrite-prompt.ts` (`buildRewriteMessages`,
  `parseRewriteResponse`, `rewriteQuery` с fail-open).
- **Совместимость моделей**: и эмбеддер, и реранкер грузятся `@huggingface/transformers` v4 напрямую,
  поэтому подходит только модель с непустым `model_type` (поддержанная архитектура) и с ONNX-весами в
  самом репозитории. `Xenova/multilingual-e5-base` и `onnx-community/bge-reranker-v2-m3-ONNX` —
  проверены; `jinaai/jina-reranker-v2-base-multilingual` не грузится (`model_type: null`),
  `onnx-community/gte-multilingual-reranker-base` — `Unsupported model type: new` (ModernBERT).
  Новую модель проверяйте пробной загрузкой до того, как вписать в `RAG_*_MODEL`.
- **Язык реранкера**: `Xenova/bge-reranker-base` — модель Chinese+English, на русских парах шумит
  (Day 23: на запрос «Какой город основан в 1703» поднимала Екатеринбург над Санкт-Петербургом).
  Дефолт заменён на мультиязычный `bge-reranker-v2-m3`.
- **Margin-guard** (`retrieval.server.ts`, `compareWithMargin`): если косинусы кандидатов равны
  (`|Δcos| ≤ COSINE_TIE_EPSILON`) и разрыв реранк-скоров меньше `RAG_RERANK_MARGIN`, порядок
  сохраняется косинусный. Страхует от шумной/сменённой модели: реранкер может перевернуть ничью
  только с уверенным отрывом.
- В `retrieval.server.ts`: `candidateK` (по умолчанию `max(4*k, 20)`) — пул до реранка; порог
  применяется **после** реранка по его скору; в выдаче ячейка несёт `score` (итоговый),
  `originalScore` (косинус) и `relevance` (реранк).

## Сравнение

`server/comparison.server.ts` считает по каждой стратегии:

- структурные метрики (`domain/metrics.ts`): число чанков, суммарные/средние/медианные/min/max
  токены, доля чанков, режущих границу раздела;
- retrieval-метрики по каждому пайплайну на наборе `data/eval-queries.ts` (16 вопросов,
  релевантность на уровне статьи): `recall@3`, `recall@5`, `MRR`, `precision@5`, `nDCG@5`.
  По умолчанию считаются дешёвые режимы (`rag`, `rag+rerank`); rewrite-режимы включаются флагом
  `includeRewrite` (вызывают LLM на каждый вопрос, переформулировки кэшируются на прогон).

## Ответ (Day 22)

Вкладка «Ответ» — первый RAG-запрос: `вопрос → поиск релевантных чанков → объединение с вопросом →
запрос к LLM`. Реализован как **фиксированный пайплайн** (не агентный цикл).

- `server/answer.server.ts` (`answerQuestion`) — глубокий модуль. Шов
  `AnswerDeps = { embedder, store, llm }`; `AnswerLlm` по умолчанию оборачивает
  `callCompletions(TIER_ENDPOINTS.medium, …)` (`temperature: 0`, `max_tokens: 700`). Для режима
  `baseline` поиск пропускается, для `rag` при `countChunks(strategy) === 0` бросается явная ошибка
  («соберите индекс») — без автосборки и фолбэков.
- `domain/answer-prompt.ts` — чистая сборка сообщений. Один базовый system для обоих режимов; у RAG
  добавляется требование опираться только на контекст и ссылаться `[n]`, контекст — нумерованный блок
  `[n] title — section\n<text>`. У baseline — просьба честно говорить «не знаю».
- `domain/answer-eval.ts` — детерминированная оценка: `matchExpected` (нормализация регистра,
  схлопывание разрядов чисел в «1 190 254»), `parseCitations` (`[n]`), `citedTitles`, `verdictFor` →
  `correct | partial | wrong | ungrounded`. «Без опоры» — RAG-ответ с фактами, но без цитат или со
  ссылкой мимо ожидаемого источника.
- `data/control-questions.ts` — 10 контрольных вопросов (`ControlQuestion { query, expected, sources }`).
  Вопросы — трудные специфики по городу (точные годы, числа переписей, имена), чтобы без RAG модель
  ошибалась/оговаривалась, а RAG отвечал по статье. Состав — дискриминирующий: подтверждается
  реальным прогоном обоих режимов, вопросы без разрыва или нерешаемые в корпусе выбрасываются.
- `functions/answer.functions.ts` — тонкий адаптер (`mode`/`strategy`/`query`/`k`/`pipeline` +
  опциональные `expected`/`expectedSources`); `api/use-rag-answer.ts` — одиночный запрос,
  `api/use-control-run.ts` — последовательный клиентский прогон 10 вопросов по выбранным пайплайнам
  (прогресс, без монолитного server fn) и scorecard «верно по режиму / 10».
- Ответ несёт `pipeline`, `rewrittenQuery`, `reranked`, `embeddingQuery`, а источники — те же
  скор-поля, что и у поиска.

## Контракт ответа и abstain (Day 24)

- **Строгий JSON от модели.** `RAG_SYSTEM` требует `{"answer": "...", "quotes": [{"n": 1, "text": "..."}]}`;
  `createDeepSeekAnswerLlm` включает `response_format: { type: 'json_object' }`, `temperature: 0`,
  `ANSWER_MAX_TOKENS = 1200`. `domain/answer-format.ts` (`parseAnswerResponse`) fail-open: битый JSON →
  `format: 'text'` с пустыми цитатами.
- **Источники — детерминированные.** Сервер сам собирает `sources` из найденных чанков
  (`title`, `source` URL, `section`, `chunk_id`, score/relevance). Модель их не придумывает — инвариант
  ответа, а не просьба.
- **Цитаты заверяются.** `verifyQuotes(quotes, chunks)` (`domain/answer-eval.ts`) принимает цитату только
  если её нормализованный текст — подстрока соответствующего чанка (`n`). Вердикт `ungrounded`, если
  подтверждённых цитат нет или ожидаемые факты не встречаются в них.
- **«Не знаю» по порогу.** `shouldAbstain` в `server/answer.server.ts`: скор верхнего кандидата ниже
  порога → сервер без вызова LLM возвращает `abstainAnswer(query)`, `abstained: true`, пустые
  `sources`/`quotes`, вердикт `abstained`. Для rerank-режимов порог — `relevance` (`RAG_RERANK_THRESHOLD`),
  для `rag`/`rag+rewrite` — косинус (`RAG_COSINE_THRESHOLD`, дефолт `0.35`). Сам `retrieve` сохраняет
  гарантию минимум одного результата — это не задевает «Поиск» и сравнение.
- **Больше контекста.** Опция `stitch` (`stitchSources`) добавляет к выдаче соседние чанки того же
  раздела/документа с флагом `stitched: true` — против «модель заблудилась» в длинной статье. Ранжирование
  не меняется.
- **Проверка.** Табличка «Контроль» считает «с источниками и подтверждёнными цитатами: N / 10»; отдельная
  кнопка прогоняет `data/abstain-questions.ts` (3 вопроса вне корпуса) и считает abstain по режимам.

## Env

| Переменная | По умолчанию | Смысл |
| --- | --- | --- |
| `RAG_EMBED_PROVIDER` | `local` | `local` (ONNX) или `hf` (HF Inference API) |
| `RAG_EMBED_MODEL` | `Xenova/multilingual-e5-base` | id модели |
| `RAG_EMBED_DTYPE` | `q8` | тип весов ONNX (`q8`/`fp32`/`fp16`/`int8`) |
| `RAG_RERANK_MODEL` | `onnx-community/bge-reranker-v2-m3-ONNX` | id кросс-энкодер-модели реранкера |
| `RAG_RERANK_DTYPE` | `q8` | тип весов реранкера (`q8`/`fp32`/`fp16`/`int8`) |
| `RAG_RERANK_THRESHOLD` | `0.5` | порог отсечения по вероятности реранкера (0..1) |
| `RAG_COSINE_THRESHOLD` | `0.35` | порог косинуса для abstain в режимах без реранка (`rag`, `rag+rewrite`) |
| `RAG_RERANK_MARGIN` | `0.1` | margin-guard: минимальный отрыв реранка, чтобы перевернуть косинусную ничью (0..1) |
| `RAG_DB_PATH` | `~/.ai-advent-challenge/rag.sqlite` | файл индекса |
| `RAG_CORPUS_DIR` | `~/.ai-advent-challenge/rag-corpus` | кеш статей |
| `RAG_WIKI_CONTACT` | URL репозитория проекта | контакт в User-Agent для MediaWiki API |
| `HUGGING_FACE_TOKEN` | — | только для `RAG_EMBED_PROVIDER=hf` |

## Тесты

- Офлайн (по умолчанию, `npm run test`): chunking/парсер заголовков, метрики, хеш-эмбеддер,
  corpus-кеш (фейковый `fetch`), пайплайн индексации/поиска/сравнения (фикстура + temp sqlite),
  ответы `answer.test.ts` (фейковый `llm`: baseline без контекста, rag с цитатами, abstain без вызова
  LLM, неверная цитата, реранк/rewrite пайплайны, ошибка на пустом индексе), `answer-format.test.ts`
  (разбор JSON/фенсов/битых цитат/фолбэк), `answer-contract.test.ts` (синтетический факт: отвечает
  только grounded-RAG; stitch соседних чанков), `rerank.test.ts` (вторая стадия: реордер, порог,
  минимум 1, margin-guard, fail-open, `candidateK`; lexical-реранкер, sigmoid, разбор rewrite) и оценка
  `answer-eval.test.ts` (факты, цитаты, заверение цитат, вердикты).
- Gated: `embedder-integration.test.ts` и `reranker-integration.test.ts` (реальная модель) —
  `RUN_MODEL_TESTS=1`; `pipeline-integration.test.ts` (реальная статья + реальная модель) —
  `RUN_MODEL_TESTS=1` и `RUN_NETWORK_TESTS=1`.

## Как портировать

1. Скопировать `src/features/rag/`.
2. Внешние зависимости: `@huggingface/transformers`, `gpt-tokenizer`, react-query, React, TanStack Start.
3. Завести роут `/rag`, рендерящий `pages/RagPage`; добавить пункт в сайдбар при необходимости.
4. Прописать env (см. таблицу), `node:sqlite` требует Node ≥ 22.
5. `npm run test` — офлайн; реальные сеть/модель — под флагами.
