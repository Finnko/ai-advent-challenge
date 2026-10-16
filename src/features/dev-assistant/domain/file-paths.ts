const FILE_EXTENSIONS = 'ts|tsx|js|jsx|mjs|md|json|ya?ml|sql|css|html'

const FILE_MENTION = new RegExp(`\\b[\\w.-]+\\.(?:${FILE_EXTENSIONS})\\b`, 'iu')

const PATH_LIKE = new RegExp(`[\\w][\\w./-]*\\.(?:${FILE_EXTENSIONS})`, 'gu')

export type PlanPathSource = {
  title: string
  steps: string[]
  step: string
}

export function looksLikeFilePath(text: string): boolean {
  return FILE_MENTION.test(text)
}

export function pathsInText(text: string): string[] {
  const found = text.match(PATH_LIKE) ?? []
  return [
    ...new Set(
      found
        .map((path) => path.replace(/^\.\//, ''))
        .filter((path) => path.includes('/') || path.includes('.')),
    ),
  ]
}

export function extractPlanPaths(state: PlanPathSource): string[] {
  return pathsInText([state.title, ...state.steps, state.step].join('\n'))
}

export function matchesPlannedPath(path: string, planned: string[]): boolean {
  return planned.some(
    (candidate) =>
      candidate === path ||
      candidate.endsWith(`/${path}`) ||
      path.endsWith(`/${candidate}`),
  )
}
