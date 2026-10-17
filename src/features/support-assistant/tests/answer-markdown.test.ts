import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AnswerMarkdown from '../components/AnswerMarkdown'

describe('AnswerMarkdown', () => {
  it('renders headings, lists and safe external links', () => {
    const html = renderToStaticMarkup(
      createElement(AnswerMarkdown, {
        text: '### По документации\n\n- первый пункт\n- второй пункт\n\n[Статья](https://seller-edu.ozon.ru/help/blocking)',
      }),
    )
    expect(html).toContain('<h3>')
    expect(html).toContain('<ul>')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer noopener"')
  })

  it('does not render raw HTML from the model', () => {
    const html = renderToStaticMarkup(
      createElement(AnswerMarkdown, {
        text: 'Текст\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>',
      }),
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
  })
})
