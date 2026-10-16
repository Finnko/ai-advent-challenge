export type FileScenarioMode = 'read' | 'write'

export type FileScenario = {
  id: string
  title: string
  goal: string
  mode: FileScenarioMode
}

export const FILE_SCENARIOS: FileScenario[] = [
  {
    id: 'find-usages',
    title: 'Найти использования',
    mode: 'read',
    goal: 'Найди все использования функции answerAboutProject в src/features/dev-assistant и покажи файл:строка.',
  },
  {
    id: 'repo-changes',
    title: 'Список изменений',
    mode: 'read',
    goal: 'Подготовь diff по изменённым файлам: покажи список файлов и сам дифф.',
  },
  {
    id: 'invariants-check',
    title: 'Проверить инварианты',
    mode: 'read',
    goal: 'Проверь соответствие изменённых файлов правилам проекта и покажи нарушения.',
  },
  {
    id: 'demo-doc',
    title: 'Демо-документ',
    mode: 'write',
    goal:
      'Создай файл docs/file-assistant-demo.md с кратким описанием файлового ассистента, ' +
      'добавь раздел про файловый режим в src/features/dev-assistant/README.md ' +
      'и допиши строку про Day 34 в README.md.',
  },
  {
    id: 'update-docs',
    title: 'Обновить доки по коду',
    mode: 'write',
    goal:
      'Обнови документацию по изменениям в коде: посмотри diff, найди README и ADR ' +
      'по затронутым файлам и приведи их в соответствие.',
  },
]

export function findFileScenario(id: string): FileScenario | null {
  return FILE_SCENARIOS.find((scenario) => scenario.id === id) ?? null
}
