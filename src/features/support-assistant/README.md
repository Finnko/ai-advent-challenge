# Support assistant

Учебный «неофициальный помощник продавцов Ozon»: страница `/support`, RAG по зеркалу документации Ozon,
контекст продавца и тикета через MCP и ответ из трёх блоков. Публикуется вторым инстансом приложения через
Tailscale Funnel; приватный инстанс продолжает жить на `serve` с портом 8443. Это Day 33.

Сервис не является поддержкой Ozon: он не пишет в тикеты, не меняет аккаунт и не выдаёт себя за официальный
канал. Продавцы, тикеты, отправления и финансы — синтетические фикстуры.

## Что делает

1. Клиент отправляет только ids: `{ sellerId, ticketId, question }`.
2. Сервер поднимает одну MCP-сессию на запрос и собирает контекст: продавца, тикет, финансы,
   отправления и товар на модерации.
3. Локальный SQLite-индекс ищет фрагменты базы знаний Ozon: e5-base, cosine top-k, лёгкий лексический
   буст по 24 кандидатам и 6 фрагментов в ответ; без реранкера.
4. `answerFromSources` из `@lib/rag-engine.server` собирает ответ по JSON-контракту и проверяет цитаты
   по отправленным чанкам.
5. Ответ содержит три markdown-раздела: «По документации», «По вашему аккаунту и тикету», «Что делать».
6. Если документов недостаточно, сервис abstain’ится и предлагает эскалацию, а не выдумывает правило Ozon.

## Модули

```
src/features/support-assistant/
  data/
    fixtures/                 sellers, tickets, postings, products, finance
    fixtures/corpus/          маленький корпус для офлайн-тестов
    help.ts                   сценарии-подсказки для страницы
  domain/
    constants.ts              strategy id, лимиты, бюджеты, regex id
    lexical-boost.ts          лексический ре-скор кандидатов: IDF, префиксы, заголовки
    types.ts                  Seller, Ticket, Posting, Product, Finance, AskResult
    persona.ts                SUPPORT_PERSONA: три блока, abstention, JSON-контракт
    ticket-prompt.ts          форматирование фактов без выдуманных полей
    ticket-context.ts         seller + ticket + finance + postings + product → блоки с бюджетом
    validation.ts             разбор и валидация запроса
    public-route.ts           allowlist публичного режима
    errors.ts                 SupportError с HTTP-статусом и Retry-After
  server/
    corpus.server.ts          CorpusSource над .cache/ozon-corpus, frontmatter, фильтр section
    chunker.server.ts         markdown-чанкер из @lib/chunking с id support
    store.server.ts           синглтон createRagStore(SUPPORT_DB_PATH)
    index.server.ts           buildIndex, статистика, assert индекса
    mcp-registry.server.ts    McpServerSpec support-mcp-ozon
    mcp-tools.server.ts       одна сессия на запрос, контекст и trace
    ask.server.ts             MCP → context → retrieval → answer
    metrics.server.ts         лимитер по XFF, дневной кап, single-flight
    warmup.server.ts          прогрев эмбеддера и health
    http.server.ts            JSON-ответы, ошибки, ограничение тела
    service.server.ts         catalog, health, ask для роутов
    config.server.ts          env с дефолтами
  mcp/ozon/
    server.ts                 stdio-вход
    register.ts               7 read-only тулов
    tools.ts                  toolkit поверх source
    source.ts                 чтение фикстур
    sandbox.ts                запрет выхода за корень фикстур
  components/                 AnswerMarkdown, AskPanel, TicketPicker, ContextPanel, SourcesList, McpTrace
  pages/SupportPage.tsx
  cli/build-index.ts
  tests/
src/routes/support.tsx
src/routes/api/support/{sellers,ask,health}.ts
src/lib/chunking/markdown.server.ts
scripts/fetch-ozon-corpus.mjs
```

## Корпус и индекс

Зеркало: `Livingbeside/mp-docs-mirror`, каталоги `ozon/kb` и `ozon/api/seller/guides`.

```bash
npm run fetch:ozon-corpus
npm run support:index
```

`fetch:ozon-corpus` скачивает tar.gz, распаковывает только нужные каталоги в `.cache/ozon-corpus` и пишет
`.fetched` с sha коммита. Повторный запуск — no-op, `--force` перекачивает.

Корпус читается с диска, frontmatter парсится без YAML-зависимости. `kind: section` (навигационные
страницы) не индексируется; статьи `kb` и 25 гайдов API идут в один индекс. В зеркале 20 `doc_id`
встречаются дважды (одна и та же страница под разными путями); корпус оставляет версию с самым свежим
`updated`. Итог на срезе 2026-10-17: 617 документов и ~16 300 чанков. `RawDoc.title` получает суффикс
`· обновлено YYYY-MM-DD`, если в frontmatter есть `updated`; у гайдов этого поля нет. URL
`seller-edu` / `docs.ozon.ru` хранится в `RawDoc.source`, поэтому он виден в панели источников.

Индекс — отдельный SQLite `support.sqlite` (`SUPPORT_DB_PATH`), стратегия `support`. Чанкер —
`@lib/chunking/markdown.server` (`createMarkdownChunker({ id })`), 48–256 токенов. Это общий шов для трёх
потребителей: `markdown` (dev-assistant), `review` (PR review) и `support` (эта фича).

## MCP

`support-mcp-ozon` — stdio-сервер, читает только `data/fixtures` через sandbox. Все тулы read-only:

| Тул | Что отдаёт |
|---|---|
| `get_seller` | статус, тариф, схема, регистрация, ограничения, замаскированные ключи |
| `list_tickets` | тикеты продавца |
| `get_ticket` | тема, статус, связанные отправление и товар, последние сообщения |
| `list_postings` | отправления продавца, опционально по статусу |
| `get_posting` | статус, срок сборки, склад, состав |
| `get_product` | статус модерации, ошибки, цена, остаток |
| `get_finance` | ближайшая выплата, начисления, удержания, прошлая выплата |

API-ключи в фикстурах хранятся только как `last4` + срок; полного ключа нет ни в промпте, ни в trace, ни
на странице. Sandbox отклоняет `..` и любой путь вне корня фикстур. Регистрация в `scripts/build-mcp.mjs`
даёт `dist/server/mcp/mcp-support-ozon.mjs`, override — `SUPPORT_MCP_OZON_ENTRY`.

## Как строится ответ

- `assertSupportIndex` падает на пустом индексе → `503 index_missing`.
- MCP-сессия одна на запрос. Если сервер недоступен, ответ строится только по документам, а `contextError`
  и trace показывают причину. Неизвестный тикет/продавец → `404`; чужой тикет → `400`.
- Контекст ограничен `SUPPORT_CONTEXT_MAX_CHARS` (6000 символов ≈ 1200 токенов на русском).
- Поиск: пул 24 кандидата (`k` и `candidateK`), лёгкий лексический буст и финальные 6 фрагментов;
  `rerank: false`, `rewrite: false`, порог косинуса общий для RAG.
- `SUPPORT_PERSONA` ставит `contextRescues: false`: контекст аккаунта дополняет ответ, но не спасает
  слабую выдачу. Поэтому вопрос вне базы честно abstain’ится даже при наличии тикета. Если выдача
  формально сильная, но модель прямо пишет «в базе знаний нет ответа», `looksAbstained` поднимает
  флаг `abstained` уже после ответа.
- `signal` из транспорта (`CallCompletionsOptions.signal` → `AnswerLlmOptions.signal`) даёт запросу
  таймаут 45 секунд; отмена не оставляет висящий fetch.
- Ответ рендерится `react-markdown` без плагинов и без raw HTML; ссылки открываются в новой вкладке.
  Стили — `@tailwindcss/typography` на токенах темы.

## Лексический буст

Векторный поиск отвечает за смысл, но на длинных русских статьях Ozon проигрывает точной формулировке:
вопрос «почему заблокировали кабинет» должен вытаскивать статью «Почему Ozon блокирует личный кабинет».
Кросс-энкодер на VPS не ставим, поэтому после cosine-отбора 24 кандидатов работает дешёвый лексический
ре-скор (`domain/lexical-boost.ts`).

- Запрос и чанк нормализуются: нижний регистр, `ё → е`, слова из букв и цифр; стоп-слова (предлоги,
  местоимения, вопросительные слова) отбрасываются, слова короче трёх символов — тоже, кроме аббревиатур
  (`ИП`, `НДС`) и токенов с цифрами.
- Русские слова от четырёх символов сравниваются по четырёхбуквенному префиксу; у длинных слов
  дополнительно пробуется вариант без приставки (`заблокировали → блоки`), поэтому «блокирует»,
  «блокировка» и «заблокировали» сходятся. Латиница, цифры и аббревиатуры (`FBS`, `SKU`, `22-НДФЛ`) —
  только точное совпадение.
- Вес термина — IDF по пулу кандидатов: `ln(1 + N / (1 + df))`; совпадение в `section` весит ×2, в
  `title` ×1.5, в тексте ×1. Покрытие — `Σ(idf · вес поля) / Σ idf`, но не больше 1.
- `score = originalScore + SUPPORT_LEXICAL_BOOST · coverage`. По умолчанию `0.03`: буст переставляет
  близких кандидатов, но не перебивает уверенный cosine-разрыв и не меняет `originalScore`.
  `SUPPORT_LEXICAL_BOOST=0` выключает его; панель источников показывает дельту как «лексика +0.0xx».
- Абстиненция по-прежнему считается по косинусу top-1: буст не превращает слабую выдачу в ответ.

## Публичный режим

`SUPPORT_PUBLIC=1` включает allowlist в `src/server.ts`: `/support`, `/assets/*`, `/favicon.ico`,
`/robots.txt`, `/api/support/{sellers,ask,health}`. Остальное получает `404`, а не `403`, чтобы не
подтверждать существование маршрутов. Заголовки: `nosniff`, `Referrer-Policy`, `no-store` для API.

Лимитер считает **только `X-Forwarded-For`** первым значением и валидирует IP. Проверка на VPS показала:
Tailscale Funnel перезаписывает клиентский `X-Forwarded-For` реальным публичным IP, но пропускает
`X-Real-IP` и не передаёт `Forwarded`; поэтому `X-Real-IP` игнорируется. Без XFF ключ — `unknown`, и
работает только глобальный кап.

- 30 запросов/час на IP;
- 60 запросов/час глобально;
- 200 запросов в сутки;
- single-flight 1, очередь 2, ожидание 15 с;
- тело ≤ 4 КБ, вопрос ≤ 800 символов;
- `429`/`503` с `Retry-After`.

## API

| Метод | Путь | Ответ |
|---|---|---|
| GET | `/api/support/sellers` | список продавцов и тикетов для пикера |
| POST | `/api/support/ask` | `AskResult` или JSON-ошибка |
| GET | `/api/support/health` | `ready`, `warming`, индекс, ошибка |

`/api/support/ask` принимает только ids и вопрос; контент документов и фикстур клиент не присылает.

## Деплой

1. Локально: `npm run fetch:ozon-corpus && npm run support:index`.
2. `npm run deploy`: копирует `support.sqlite` в `/var/lib/ai-advent/`, собирает приложение, ставит
   `ai-advent.service` (3000) и `ai-advent-support.service` (3001).
3. `serve --https=8443 3000` — приватное приложение; `funnel --https=443 3001` — только `/support`.
4. `SUPPORT_PUBLIC=1` живёт только в юните support-сервиса; общий `/etc/ai-advent.env` его не содержит.
5. Health: `/api/support/health` на 3001. Первый старт прогревает e5-base (~120 МБ) в фоне; пока модель
   грузится, публичный `/ask` отвечает `503 warming` с `Retry-After`.
6. Публичный DNS Funnel появляется не мгновенно (до 10 минут по документации Tailscale). Деплой не
   должен падать из-за внешней проверки: health на 3001 локальный, публичную ссылку проверяем ретраями.

Локально и на VPS держим одинаковые `RAG_EMBED_MODEL` и `RAG_EMBED_DTYPE=q8`, иначе векторы индекса и
запроса расходятся. `support.sqlite` переносится с локальной машины; на VPS корпус не нужен.

## Тесты

Офлайн, без модели:

- `lib/chunking/markdown.test.ts` — общий чанкер и независимость strategy id;
- `tests/corpus.test.ts` — frontmatter, фильтр `kind: section`, дата в заголовке, source;
- `tests/ticket-context.test.ts` — бюджет, маска ключей, отсутствующие поля;
- `tests/validation.test.ts` — ids, длина вопроса, allowlist;
- `tests/metrics.test.ts` — per-IP, global, daily, XFF и `X-Real-IP`, очередь;
- `tests/ozon-tools.test.ts`, `tests/mcp.test.ts` — семь тулов, structured content, sandbox;
- `tests/ask.test.ts` — порядок MCP → search → answer, лексический буст, abstention, деградация MCP,
  чужой тикет, пустой индекс;
- `tests/lexical-boost.test.ts` — нормализация, стоп-слова, префиксы и приставки, IDF, вес раздела,
  выключатель;
- `tests/http.test.ts` — тело, 429 и `Retry-After`;
- `tests/answer-markdown.test.ts` — markdown и отсутствие raw HTML.

Гейтед-тест реальной модели: `RUN_MODEL_TESTS=1` с собранным индексом и ключом DeepSeek.

## Решения

- **Почему серверный роут, а не `createServerFn`.** Публичному инстансу нужен стабильный путь
  `/api/support/*`, который можно разрешить целиком, а `/_serverFn/<hash>` фильтровать нельзя.
- **Почему без tool-loop.** Набор данных фиксирован, контекст собирается один раз; это дешевле,
  детерминированнее и целиком видно в trace. `runToolLoop` остаётся швом на будущее.
- **Почему `contextRescues: false`.** Продукт отвечает по документации; контекст не должен превращать
  вопрос вне базы в выдуманный ответ. Контрольный негатив (вопрос про погоду) это проверяет.
- **Почему markdown-чанкер в `@lib`.** Три потребителя не должны копировать одну и ту же нарезку;
  фабрика параметризует только `id`, а общий структурный движок остаётся в RAG-движке.
- **Почему лексический буст, а не реранкер.** Кросс-энкодер `bge-reranker-v2-m3` не влезает в 2 ГБ VPS
  и добавляет секунды на 1 vCPU; FTS5 требует второго индекса. 24 кандидата на запрос уже отбираются
  cosine-поиском, поэтому лексический ре-скор по IDF и префиксам стоит микросекунды, не требует модели и
  поправляет ровно тот случай, где dense-поиск слаб, — точную формулировку из вопроса продавца.

См. `docs/adr/0019-support-assistant.md`.
