# Feature: RAG

Индексация документов: корпус статей Википедии о городах России → разбиение на чанки двумя
стратегиями → эмбеддинги → локальный SQLite-индекс (метаданные + векторы) → top-k поиск →
сравнение стратегий по структуре и качеству поиска.

Фича самодостаточна и спроектирована под перенос в другой TanStack Start проект. Публичная
поверхность — экран `/rag` (`pages/RagPage`).

## Структура

```
src/features/rag/
  pages/         # RagPage — табы Индекс / Поиск / Сравнение
  api/           # react-query: use-rag-index, use-rag-search, use-rag-corpus, use-rag-chunks
  functions/     # createServerFn-адаптеры: build-index, search, get-index-stats, get-comparison,
                 # list-corpus, list-chunks + validation.ts
  server/        # *.server.ts: corpus, embedder, index-store, indexing, retrieval, comparison, rag
  domain/        # изоморфно, без env/fetch: chunking/{fixed,structural,registry,windows,types}, corpus,
                 # embedder (шов + hash-эмбеддер), wikipedia (парсер заголовков), metrics, types
  data/          # cities (15 городов), corpus (снапшот 15 статей), eval-queries (16 вопросов), rag-ui (подписи)
  components/    # IndexPanel, SearchPanel, ComparisonPanel, ChunkBrowser
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
- `server/retrieval.server.ts` (`searchChunks`): эмбеддинг запроса (query) → brute-force косинус по
  сохранённым векторам → top-k.

## Сравнение

`server/comparison.server.ts` считает по каждой стратегии:

- структурные метрики (`domain/metrics.ts`): число чанков, суммарные/средние/медианные/min/max
  токены, доля чанков, режущих границу раздела;
- retrieval-метрики на наборе `data/eval-queries.ts` (16 вопросов, релевантность на уровне статьи):
  `recall@3`, `recall@5`, `MRR`.

## Env

| Переменная | По умолчанию | Смысл |
| --- | --- | --- |
| `RAG_EMBED_PROVIDER` | `local` | `local` (ONNX) или `hf` (HF Inference API) |
| `RAG_EMBED_MODEL` | `Xenova/multilingual-e5-base` | id модели |
| `RAG_EMBED_DTYPE` | `q8` | тип весов ONNX (`q8`/`fp32`/`fp16`/`int8`) |
| `RAG_DB_PATH` | `~/.ai-advent-challenge/rag.sqlite` | файл индекса |
| `RAG_CORPUS_DIR` | `~/.ai-advent-challenge/rag-corpus` | кеш статей |
| `RAG_WIKI_CONTACT` | URL репозитория проекта | контакт в User-Agent для MediaWiki API |
| `HUGGING_FACE_TOKEN` | — | только для `RAG_EMBED_PROVIDER=hf` |

## Тесты

- Офлайн (по умолчанию, `npm run test`): chunking/парсер заголовков, метрики, хеш-эмбеддер,
  corpus-кеш (фейковый `fetch`), пайплайн индексации/поиска/сравнения (фикстура + temp sqlite).
- Gated: `embedder-integration.test.ts` (реальная модель) — `RUN_MODEL_TESTS=1`;
  `pipeline-integration.test.ts` (реальная статья + реальная модель) — `RUN_MODEL_TESTS=1` и
  `RUN_NETWORK_TESTS=1`.

## Как портировать

1. Скопировать `src/features/rag/`.
2. Внешние зависимости: `@huggingface/transformers`, `gpt-tokenizer`, react-query, React, TanStack Start.
3. Завести роут `/rag`, рендерящий `pages/RagPage`; добавить пункт в сайдбар при необходимости.
4. Прописать env (см. таблицу), `node:sqlite` требует Node ≥ 22.
5. `npm run test` — офлайн; реальные сеть/модель — под флагами.
