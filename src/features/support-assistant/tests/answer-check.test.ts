import { describe, expect, it } from 'vitest'
import { looksAbstained } from '../domain/answer-check'

describe('looksAbstained', () => {
  it('detects an explicit no-answer in the docs block', () => {
    expect(
      looksAbstained(
        '### По документации\n\nВ базе знаний Ozon нет информации о погоде.\n\n### Что делать\n\n1. Проверьте погодный сервис.',
      ),
    ).toBe(true)
    expect(
      looksAbstained(
        '### По документации\n\nВ базе знаний нет ответа на этот вопрос.\n\n### Что делать\n\n1. Напишите в поддержку.',
      ),
    ).toBe(true)
  })

  it('does not flag a useful docs answer because another block lacks details', () => {
    expect(
      looksAbstained(
        [
          '### По документации',
          'Откройте вкладку «Ошибки» и исправьте карточку [2].',
          '',
          '### По вашему аккаунту и тикету',
          'В базе знаний нет фрагментов именно про сертификат.',
          '',
          '### Что делать',
          '1. Исправьте описание.',
        ].join('\n'),
      ),
    ).toBe(false)
  })

  it('keeps a normal answer', () => {
    expect(
      looksAbstained(
        '### По документации\n\nСоберите отправление до срока [1].',
      ),
    ).toBe(false)
  })
})
