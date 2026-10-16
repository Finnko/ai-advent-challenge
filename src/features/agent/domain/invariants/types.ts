export * from '@lib/invariants/types'

export const invariantCheckIds = [
  'meeting-end-time',
  'vacation-duration',
  'orion-employee',
  'sqlite-only',
  'server-secrets',
] as const

export type InvariantCheckId = (typeof invariantCheckIds)[number]
