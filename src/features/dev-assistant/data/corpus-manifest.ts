export type CorpusGroup = 'docs' | 'adr' | 'schema' | 'code'

export type CorpusFile = {
  id: string
  title: string
  path: string
  group: CorpusGroup
}

export const CORPUS_GROUP_LABELS: Record<CorpusGroup, string> = {
  docs: 'Документация',
  adr: 'Решения (ADR)',
  schema: 'Схемы и API',
  code: 'Исходный код',
}

export const CORPUS_GROUP_ORDER: CorpusGroup[] = [
  'docs',
  'adr',
  'schema',
  'code',
]

// Curated, explicit list: the assistant must answer about the project's own
// docs, so the corpus is hand-picked rather than globbed. The Day-32 review
// pipeline keeps this docs list and adds a walked `code` group on top
// (`server/review-corpus.server.ts`); the engine does not care either way.
export const PROJECT_CORPUS: CorpusFile[] = [
  { id: 'readme', title: 'README.md', path: 'README.md', group: 'docs' },
  { id: 'agents', title: 'AGENTS.md', path: 'AGENTS.md', group: 'docs' },
  { id: 'glossary', title: 'GLOSSARY.md', path: 'GLOSSARY.md', group: 'docs' },
  {
    id: 'coding-standards',
    title: 'CODING_STANDARDS.md',
    path: 'CODING_STANDARDS.md',
    group: 'docs',
  },
  {
    id: 'feature-agent',
    title: 'features/agent/README.md',
    path: 'src/features/agent/README.md',
    group: 'docs',
  },
  {
    id: 'feature-rag',
    title: 'features/rag/README.md',
    path: 'src/features/rag/README.md',
    group: 'docs',
  },
  {
    id: 'feature-telegram-quiz',
    title: 'features/telegram-quiz/README.md',
    path: 'src/features/telegram-quiz/README.md',
    group: 'docs',
  },
  {
    id: 'feature-llm-opt',
    title: 'features/llm-opt/README.md',
    path: 'src/features/llm-opt/README.md',
    group: 'docs',
  },
  {
    id: 'feature-llm-service',
    title: 'features/llm-service/README.md',
    path: 'src/features/llm-service/README.md',
    group: 'docs',
  },
  {
    id: 'adr-0001',
    title: 'ADR-0001: MCP tool metadata via annotations',
    path: 'docs/adr/0001-mcp-tool-metadata-via-annotations.md',
    group: 'adr',
  },
  {
    id: 'adr-0002',
    title: 'ADR-0002: agent store split by concept',
    path: 'docs/adr/0002-agent-store-split-by-concept.md',
    group: 'adr',
  },
  {
    id: 'adr-0003',
    title: 'ADR-0003: reranker ONNX model',
    path: 'docs/adr/0003-reranker-onnx-model.md',
    group: 'adr',
  },
  {
    id: 'adr-0004',
    title: 'ADR-0004: multilingual reranker margin guard',
    path: 'docs/adr/0004-multilingual-reranker-margin-guard.md',
    group: 'adr',
  },
  {
    id: 'adr-0005',
    title: 'ADR-0005: RAG answer contract and abstention',
    path: 'docs/adr/0005-rag-answer-contract-and-abstention.md',
    group: 'adr',
  },
  {
    id: 'adr-0006',
    title: 'ADR-0006: Telegram quiz bot',
    path: 'docs/adr/0006-telegram-quiz-bot.md',
    group: 'adr',
  },
  {
    id: 'adr-0007',
    title: 'ADR-0007: local LLM optimization lab',
    path: 'docs/adr/0007-local-llm-optimization-lab.md',
    group: 'adr',
  },
  {
    id: 'adr-0008',
    title: 'ADR-0008: local LLM as public service',
    path: 'docs/adr/0008-local-llm-as-public-service.md',
    group: 'adr',
  },
  {
    id: 'rag-index-store',
    title: 'RAG index schema (index-store.server.ts)',
    path: 'src/features/rag/server/index-store.server.ts',
    group: 'schema',
  },
  {
    id: 'agent-store-db',
    title: 'Agent store schema (store/db.server.ts)',
    path: 'src/features/agent/server/store/db.server.ts',
    group: 'schema',
  },
  {
    id: 'rag-domain-types',
    title: 'RAG domain types',
    path: 'src/features/rag/domain/types.ts',
    group: 'schema',
  },
  {
    id: 'rag-wire-types',
    title: 'RAG wire types',
    path: 'src/features/rag/types.ts',
    group: 'schema',
  },
  {
    id: 'agent-capability-types',
    title: 'Agent capability contract',
    path: 'src/features/agent/domain/capabilities/types.ts',
    group: 'schema',
  },
  {
    id: 'package-json',
    title: 'package.json (scripts)',
    path: 'package.json',
    group: 'schema',
  },
]

export const PROJECT_QUESTIONS: string[] = [
  'Из каких фич состоит проект и за что отвечает каждая?',
  'Как в проекте устроена RAG-индексация и какие есть стратегии чанкинга?',
  'Как устроена память агента и какие слои контекста есть?',
  'Какие MCP-серверы подключены и как выводятся их инструменты?',
  'Какая сейчас ветка и что изменено в рабочем дереве?',
]
