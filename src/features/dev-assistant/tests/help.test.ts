import { describe, expect, it } from 'vitest'
import { helpText, parseInput } from '../data/help'

describe('/help command parsing', () => {
  it('treats bare /help as the help command', () => {
    expect(parseInput('/help')).toEqual({ kind: 'help' })
    expect(parseInput('  /help  ')).toEqual({ kind: 'help' })
  })

  it('answers explicit /help questions', () => {
    expect(parseInput('/help как устроен агент?')).toEqual({
      kind: 'question',
      question: 'как устроен агент?',
    })
    expect(parseInput('/help ')).toEqual({ kind: 'help' })
  })

  it('passes bare questions through', () => {
    expect(parseInput('из чего состоит проект?')).toEqual({
      kind: 'question',
      question: 'из чего состоит проект?',
    })
    expect(parseInput('')).toEqual({ kind: 'empty' })
  })

  it('renders a help text that mentions the corpus', () => {
    const text = helpText()
    expect(text).toContain('ai-advent-challenge')
    expect(text).toContain('В корпусе')
    expect(text).toContain('Документация')
    expect(text).toContain('/help')
  })
})
