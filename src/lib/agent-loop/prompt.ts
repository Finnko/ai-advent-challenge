import type { Tool } from './types'

export const REQUEST_SCOPE_LINES = [
  'Если запрос требует действия из списка доступных инструментов — выбери ровно один. Выполняй только то, что нужно для запроса. Если следующий шаг выполнять не требуется — верни tool: null.',
  'Если пользователь ссылается на «эту встречу», «эту заявку», «её/его» или «последнюю», подставь данные из контекста и вызови соответствующий инструмент — не переспрашивай.',
]

export const REF_INSTRUCTION_LINE =
  'Ответь ровно одним json-объектом вида {"tool": "имя_инструмента" | null, "args": { ... }}. Значение аргумента может быть ссылкой на вывод ранее вызванного инструмента: {"$ref": "<номер>"} или {"$ref": "last"}. Большие тексты передавай ссылкой, а не копированием. Без текста до "{" и после "}", без markdown.'

export const TOOL_REPORT_PREFIX = 'ОТЧЁТ ИНСТРУМЕНТА'

export function resolveToolCatalog<TContext>(
  tools: Tool<TContext>[],
  toolNames: string[],
): Tool<TContext>[] {
  return toolNames
    .map((name) => tools.find((tool) => tool.name === name))
    .filter((tool): tool is Tool<TContext> => Boolean(tool))
}

export function toolCatalogLines<TContext>(tools: Tool<TContext>[]): string[] {
  return tools.map(
    (tool) =>
      `- ${tool.name}: ${tool.description}. Аргументы: ${tool.argsExample}`,
  )
}

export function buildGatedCatalog<TContext>(
  tools: Tool<TContext>[],
  gatedToolNames: string[],
  hints: Record<string, string[]> = {},
): string | null {
  const gated = resolveToolCatalog(tools, gatedToolNames)
  if (gated.length === 0) {
    return null
  }
  return [
    'Инструменты, которые станут доступны после подтверждения плана (сейчас их НЕ вызывай, но используй их параметры, чтобы предложить конкретный план):',
    ...toolCatalogLines(gated),
    ...gated.flatMap((tool) => hints[tool.name] ?? []),
  ].join('\n')
}

export function buildAvailableCatalog<TContext>(
  tools: Tool<TContext>[],
  availableToolNames: string[],
): string | null {
  const available = resolveToolCatalog(tools, availableToolNames)
  if (available.length === 0) {
    return null
  }
  return [
    'Доступные сейчас (на текущем этапе) инструменты — их можно вызывать:',
    ...toolCatalogLines(available),
  ].join('\n')
}

export function buildLanguageLine(
  responseLanguage: string | null,
  hasProfileBlocks: boolean,
): string {
  if (responseLanguage) {
    return `Язык ответа: ${responseLanguage}. Отвечай на нём, даже если запрос или отчёт инструмента на русском.`
  }
  if (hasProfileBlocks) {
    return 'Язык и стиль ответа — по блоку ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (по умолчанию русский).'
  }
  return 'Отвечай по-русски.'
}
