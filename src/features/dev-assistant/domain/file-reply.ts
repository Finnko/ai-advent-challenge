import { looksLikeApproval, looksLikeCancel } from '@lib/task-state/gates'
import { looksLikeFileTask } from './file-router'

const CANCEL_HINTS =
  /^\s*(?:нет|не\s+надо|не\s+нужно|передумал|отмен[а-яё]*)(?![а-яёa-z0-9_])/u

export type PlanReply = 'approve' | 'new-goal' | 'cancel'

export function resolvePlanReply(text: string): PlanReply {
  if (looksLikeFileTask(text)) {
    return 'new-goal'
  }
  if (looksLikeApproval(text)) {
    return 'approve'
  }
  if (looksLikeCancel(text) || CANCEL_HINTS.test(text.toLowerCase())) {
    return 'cancel'
  }
  return 'new-goal'
}
