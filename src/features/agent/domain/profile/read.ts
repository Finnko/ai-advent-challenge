import type { SystemBlock } from '../agent'
import type { ProfileRecord } from './types'
import { PROFILE_BLOCK_TITLE, PROFILE_FIELDS, PROFILE_FIELD_LABELS } from './types'

export function formatProfileBlock(profile: ProfileRecord): string {
  const fieldLines = PROFILE_FIELDS.filter(
    (field) => field !== 'instructions',
  )
    .map((field) => {
      const value = profile[field]
      return value ? `- ${PROFILE_FIELD_LABELS[field]}: ${value}` : null
    })
    .filter((line): line is string => line !== null)

  const sections: string[] = []
  if (fieldLines.length > 0) {
    sections.push(fieldLines.join('\n'))
  }
  if (profile.instructions) {
    sections.push(`Инструкции:\n${profile.instructions}`)
  }
  if (sections.length === 0) {
    return ''
  }
  return `${PROFILE_BLOCK_TITLE}\n${sections.join('\n\n')}`
}

export function buildProfileBlocks(
  profile: ProfileRecord | null,
): SystemBlock[] {
  if (!profile) {
    return []
  }
  const content = formatProfileBlock(profile)
  return content.length > 0 ? [{ kind: 'profile' as const, content }] : []
}
