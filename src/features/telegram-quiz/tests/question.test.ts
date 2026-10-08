import { describe, expect, it } from 'vitest'
import { extractJsonObject, parseQuestion } from '../domain/question'

const VALID = {
  question: 'Столица Франции?',
  options: ['Париж', 'Рим', 'Мадрид', 'Берлин'],
  correctIndex: 0,
  explanation: 'Париж — столица Франции.',
}

describe('extractJsonObject', () => {
  it('вытаскивает объект из прозы', () => {
    const text = `Вот вопрос: ${JSON.stringify(VALID)} — готово.`
    expect(extractJsonObject(text)).toBe(JSON.stringify(VALID))
  })

  it('снимает markdown-обёртку', () => {
    const text = `\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\``
    expect(extractJsonObject(text)).toBe(JSON.stringify(VALID))
  })

  it('не путается на фигурных скобках внутри строк', () => {
    const value = { ...VALID, explanation: 'используй {} и {x}' }
    expect(extractJsonObject(JSON.stringify(value))).toBe(JSON.stringify(value))
  })

  it('возвращает null без объекта', () => {
    expect(extractJsonObject('просто текст')).toBeNull()
  })
})

describe('parseQuestion', () => {
  it('разбирает валидный вопрос', () => {
    expect(parseQuestion(JSON.stringify(VALID))).toEqual(VALID)
  })

  it('разбирает вопрос в прозе', () => {
    expect(parseQuestion(`Ответ модели: ${JSON.stringify(VALID)}`)).toEqual(
      VALID,
    )
  })

  it('отклоняет неверное число вариантов', () => {
    const broken = { ...VALID, options: ['Париж', 'Рим', 'Мадрид'] }
    expect(() => parseQuestion(JSON.stringify(broken))).toThrow()
  })

  it('отклоняет одинаковые варианты ответа', () => {
    const broken = {
      ...VALID,
      options: [
        'Сверхъестественное',
        'Сверхъестественное',
        'Сверхъестественное',
        'Сверхъестественное',
      ],
    }
    expect(() => parseQuestion(JSON.stringify(broken))).toThrow()
  })

  it('отклоняет варианты, различающиеся только регистром', () => {
    const broken = { ...VALID, options: ['Париж', 'париж', 'Мадрид', 'Берлин'] }
    expect(() => parseQuestion(JSON.stringify(broken))).toThrow()
  })

  it('отклоняет посторонние символы (CJK) в вариантах', () => {
    const broken = {
      ...VALID,
      options: ['Париж', 'Рим', 'Дэвид芬奇', 'Берлин'],
    }
    expect(() => parseQuestion(JSON.stringify(broken))).toThrow()
  })

  it('принимает латиницу, цифры и пунктуацию', () => {
    const value = {
      ...VALID,
      question: 'Кто снял «The Matrix» (1999)?',
      options: ['Лана Вачовски', 'Джо Данте', 'Джеймс Кэмерон', 'Ридли Скотт'],
      explanation: 'Братья (сёстры) Вачовски — режиссёры «The Matrix» — 1999.',
    }
    expect(parseQuestion(JSON.stringify(value))).toEqual(value)
  })

  it('отклоняет выход correctIndex за границы', () => {
    const broken = { ...VALID, correctIndex: 4 }
    expect(() => parseQuestion(JSON.stringify(broken))).toThrow()
  })

  it('отклоняет отсутствие объяснения', () => {
    const broken = {
      question: VALID.question,
      options: VALID.options,
      correctIndex: VALID.correctIndex,
    }
    expect(() => parseQuestion(JSON.stringify(broken))).toThrow()
  })

  it('отклоняет текст без JSON', () => {
    expect(() => parseQuestion('никакого json тут нет')).toThrow()
  })
})
