import { describe, expect, it } from 'vitest'
import { runStaticChecks } from '../domain/code-checks'
import type { SourceFile } from '../domain/sources'

function file(path: string, content: string): SourceFile {
  return { path, content }
}

function outcome(files: SourceFile[], code: string) {
  return runStaticChecks(files).find((item) => item.code === code)
}

describe('runStaticChecks', () => {
  it('ловит обработчик без префикса handle (Д2)', () => {
    const result = outcome(
      [
        file(
          'src/components/Button.tsx',
          'const onClickHandler = () => {};\nexport const Button = () => <button onClick={onClickHandler} />;\n',
        ),
      ],
      'Д2',
    )
    expect(result?.status).toBe('fail')
    expect(result?.findings[0]).toContain('handle')
  })

  it('пропускает обработчик с префиксом handle (Д2)', () => {
    const result = outcome(
      [
        file(
          'src/components/Button.tsx',
          'const handleClick = () => {};\nexport const Button = () => <button onClick={handleClick} />;\n',
        ),
      ],
      'Д2',
    )
    expect(result?.status).toBe('pass')
  })

  it('ловит колбэк в props без префикса on (Д9)', () => {
    const result = outcome(
      [
        file(
          'src/components/Card.tsx',
          'type CardProps = {\n  click: () => void;\n  title: string;\n};\n',
        ),
      ],
      'Д9',
    )
    expect(result?.status).toBe('fail')
    expect(result?.findings[0]).toContain('on')
  })

  it('ловит тип действия в верхнем регистре (Д19)', () => {
    const result = outcome(
      [
        file(
          'src/store/favorites.ts',
          "export const addFavorite = (id) => ({ type: 'ADD_FAVORITE', id });\n",
        ),
      ],
      'Д19',
    )
    expect(result?.status).toBe('fail')
    expect(result?.findings[0]).toContain('домен/действие')
  })

  it('принимает тип действия домен/действие (Д19)', () => {
    const result = outcome(
      [
        file(
          'src/store/favorites.ts',
          "export const addFavorite = (id) => ({ type: 'favorites/addFavorite', id });\n",
        ),
      ],
      'Д19',
    )
    expect(result?.status).toBe('pass')
  })

  it('ловит кастомный хук без префикса use (Д21)', () => {
    const result = outcome(
      [
        file(
          'src/hooks/useUser.ts',
          'export const user = () => {\n  const [value, setValue] = useState(0);\n  return value;\n};\n',
        ),
      ],
      'Д21',
    )
    expect(result?.status).toBe('fail')
    expect(result?.findings[0]).toContain('use')
  })

  it('принимает кастомный хук с префиксом use (Д21)', () => {
    const result = outcome(
      [
        file(
          'src/hooks/useUser.ts',
          'export const useUser = () => {\n  const [value] = useState(0);\n  return value;\n};\n',
        ),
      ],
      'Д21',
    )
    expect(result?.status).toBe('pass')
  })

  it('ловит тест не рядом с файлом (Д24)', () => {
    const result = outcome(
      [
        file('src/components/Card.tsx', 'export const Card = () => null;\n'),
        file('src/__tests__/Card.test.tsx', 'test("x", () => {});\n'),
      ],
      'Д24',
    )
    expect(result?.status).toBe('fail')
  })

  it('принимает тест рядом с файлом (Д24)', () => {
    const result = outcome(
      [
        file('src/components/Card.tsx', 'export const Card = () => null;\n'),
        file('src/components/Card.test.tsx', 'test("x", () => {});\n'),
      ],
      'Д24',
    )
    expect(result?.status).toBe('pass')
  })

  it('ловит прямое обращение к DOM (Д28)', () => {
    const result = outcome(
      [
        file(
          'src/components/Modal.tsx',
          "export const Modal = () => {\n  const node = document.querySelector('.root');\n  return null;\n};\n",
        ),
      ],
      'Д28',
    )
    expect(result?.status).toBe('fail')
    expect(result?.findings[0]).toContain('ref')
  })

  it('возвращает not_checked, когда нечего проверять', () => {
    const results = runStaticChecks([])
    for (const item of results) {
      expect(item.status).toBe('not_checked')
    }
  })
})
