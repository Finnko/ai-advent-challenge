import { describe, expect, it } from 'vitest'
import {
  answerFromSources,
  type AnswerLlm,
  type SourcesOutcome,
} from '@lib/rag-engine.server'
import type { Chunk, PromptMessage, ScoredChunk } from '@lib/rag-engine.types'
import { abstainAnswer, PROJECT_PERSONA } from '../domain/prompt'

const CHUNK: Chunk = {
  chunkId: 'readme:markdown:0',
  strategy: 'markdown',
  docId: 'readme',
  source: 'README.md',
  title: 'README.md',
  section: 'Stack',
  sectionPath: ['Stack'],
  position: 0,
  charStart: 0,
  charEnd: 20,
  nTokens: 4,
  crossesSection: false,
  text: 'Стек проекта: TanStack Start.',
}

const ANSWER = JSON.stringify({
  answer: 'TanStack Start [1]',
  quotes: [{ n: 1, text: 'TanStack Start' }],
})

function fakeLlm(content: string) {
  const calls: PromptMessage[][] = []
  const llm: AnswerLlm = async (messages) => {
    calls.push(messages)
    return {
      content,
      usage: { prompt_tokens: 10, completion_tokens: 5 },
      latencyMs: 2,
      model: 'test',
    }
  }
  return { llm, calls }
}

function outcome(weak: boolean): SourcesOutcome {
  const sources: ScoredChunk[] = [{ chunk: CHUNK, score: 0.9 }]
  return {
    sources: weak ? [] : sources,
    reranked: false,
    candidateCount: sources.length,
    embeddingQuery: 'q',
    rewrittenQuery: null,
    confidence: weak ? 0.1 : 0.9,
    threshold: 0.35,
    weak,
  }
}

describe('project answering persona', () => {
  it('puts the repository context and docs into the user message', async () => {
    const { llm, calls } = fakeLlm(ANSWER)

    await answerFromSources({
      question: 'Какая сейчас ветка?',
      persona: PROJECT_PERSONA,
      retrieval: outcome(false),
      contextBlocks: ['### Ветка\nfeature/day31'],
      generator: 'cloud',
      llm,
    })

    const messages = calls[0]
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
    const user = messages[1].content
    expect(user).toContain('feature/day31')
    expect(user).toContain('[1] README.md — Stack')
    expect(user).toContain('Вопрос: Какая сейчас ветка?')
  })

  it('omits the context section when there is no context', async () => {
    const { llm, calls } = fakeLlm(ANSWER)

    await answerFromSources({
      question: 'Что такое RAG?',
      persona: PROJECT_PERSONA,
      retrieval: outcome(false),
      generator: 'cloud',
      llm,
    })

    expect(calls[0][1].content).not.toContain('Контекст репозитория')
  })

  it('answers a state question when a context block rescues a weak retrieval', async () => {
    const { llm, calls } = fakeLlm(ANSWER)

    const answer = await answerFromSources({
      question: 'Какая сейчас ветка?',
      persona: PROJECT_PERSONA,
      retrieval: outcome(true),
      contextBlocks: ['### Ветка\nfeature/day31'],
      generator: 'cloud',
      llm,
    })

    expect(answer.abstained).toBe(false)
    expect(answer.contextUsed).toBe(true)
    expect(calls[0][1].content).not.toContain('Фрагменты документации проекта')
  })

  it('abstains without calling the model when the docs are weak and there is no context', async () => {
    const { llm, calls } = fakeLlm(ANSWER)

    const answer = await answerFromSources({
      question: 'Что такое RAG?',
      persona: PROJECT_PERSONA,
      retrieval: outcome(true),
      generator: 'cloud',
      llm,
    })

    expect(answer.abstained).toBe(true)
    expect(answer.answer).toContain('документации проекта')
    expect(calls).toHaveLength(0)
  })

  it('abstains with a project-specific message', () => {
    expect(abstainAnswer('вопрос')).toContain('документации проекта')
  })
})
