import { describe, expect, it } from 'vitest'
import { abstainAnswer, buildProjectMessages } from '../domain/prompt'
import type { Chunk } from '@lib/rag-engine.types'

const CHUNK: Chunk = {
  chunkId: 'readme:structural:0',
  strategy: 'structural',
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

describe('project prompt', () => {
  it('puts the repository context and docs into the user message', () => {
    const messages = buildProjectMessages({
      question: 'Какая сейчас ветка?',
      chunks: [CHUNK],
      contextBlocks: ['### Ветка\nfeature/day31'],
    })
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
    const user = messages[1].content
    expect(user).toContain('feature/day31')
    expect(user).toContain('[1] README.md — Stack')
    expect(user).toContain('Вопрос: Какая сейчас ветка?')
  })

  it('omits the context section when there is no context', () => {
    const messages = buildProjectMessages({
      question: 'Что такое RAG?',
      chunks: [CHUNK],
    })
    expect(messages[1].content).not.toContain('Контекст репозитория')
  })

  it('abstains with a project-specific message', () => {
    expect(abstainAnswer('вопрос')).toContain('документации проекта')
  })
})
