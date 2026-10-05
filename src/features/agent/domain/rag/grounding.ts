import type { Grounding, RetrievedSource } from '../capabilities/types'

export function groundingFor(
  cited: number[],
  sources: RetrievedSource[],
): Grounding {
  if (sources.length === 0) {
    return 'no-data'
  }
  const valid = cited.filter((index) => index >= 1 && index <= sources.length)
  return valid.length > 0 ? 'grounded' : 'ungrounded'
}
