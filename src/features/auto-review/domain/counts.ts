import type { CriterionResult } from '../types'

export type VerdictCounts = {
  passed: number
  failed: number
  notChecked: number
  total: number
}

export function countVerdicts(results: CriterionResult[]): VerdictCounts {
  let passed = 0
  let failed = 0
  let notChecked = 0
  for (const result of results) {
    if (result.status === 'pass') {
      passed += 1
    } else if (result.status === 'fail') {
      failed += 1
    } else {
      notChecked += 1
    }
  }
  return { passed, failed, notChecked, total: passed + failed + notChecked }
}
