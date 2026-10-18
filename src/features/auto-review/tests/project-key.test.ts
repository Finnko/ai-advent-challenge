import { describe, expect, it } from 'vitest'
import { projectKeyFromSourceName } from '../domain/project-key'

describe('projectKeyFromSourceName', () => {
  it('берёт имя zip-архива без расширения', () => {
    expect(projectKeyFromSourceName('ivan-ivanov.zip')).toBe('ivan-ivanov')
    expect(projectKeyFromSourceName('/tmp/Student Project.ZIP')).toBe(
      'student-project',
    )
  })

  it('берёт имя папки из пути', () => {
    expect(projectKeyFromSourceName('/Users/me/work/student-project')).toBe(
      'student-project',
    )
    expect(projectKeyFromSourceName('~/work/student-project/')).toBe(
      'student-project',
    )
  })

  it('транслитерирует кириллицу', () => {
    expect(projectKeyFromSourceName('Иван Иванов.zip')).toBe('ivan-ivanov')
    expect(projectKeyFromSourceName('/tmp/Шесть городов')).toBe('shest-gorodov')
  })

  it('сохраняет e-mail', () => {
    expect(projectKeyFromSourceName('ivan@example.com.zip')).toBe(
      'ivan@example.com',
    )
  })

  it('чистит лишние символы и ограничивает длину', () => {
    expect(projectKeyFromSourceName('  -- Иван  Иванов --.zip')).toBe(
      'ivan-ivanov',
    )
    expect(projectKeyFromSourceName(`${'a'.repeat(200)}.zip`)).toHaveLength(120)
  })

  it('возвращает пустую строку, если имя не даёт ключ', () => {
    expect(projectKeyFromSourceName('/')).toBe('')
    expect(projectKeyFromSourceName('🎓.zip')).toBe('')
  })
})
