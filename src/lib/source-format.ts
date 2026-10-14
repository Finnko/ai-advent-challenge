export type NumberedSource = {
  title: string
  section?: string | null
  text: string
  source?: string
}

export type NumberedSourceOptions = {
  header?: string
  withSource?: boolean
}

export function sourceLabel(source: NumberedSource): string {
  return source.section ? `${source.title} — ${source.section}` : source.title
}

export function formatNumberedSource(
  source: NumberedSource,
  index: number,
  withSource: boolean,
): string {
  const label = `[${index + 1}] ${sourceLabel(source)}`
  if (withSource && source.source) {
    return `${label}\n${source.source}\n${source.text}`
  }
  return `${label}\n${source.text}`
}

export function formatNumberedSources(
  sources: NumberedSource[],
  options: NumberedSourceOptions = {},
): string {
  const lines = sources.map((source, index) =>
    formatNumberedSource(source, index, options.withSource === true),
  )
  const body = lines.join('\n\n')
  return options.header ? `${options.header}\n\n${body}` : body
}
