import { createServerFn } from '@tanstack/react-start'
import { resolveCapabilitiesByToken } from '../agent-service.server'
import { asObject, requireToken } from './validation'

export const resolveCapabilities = createServerFn({ method: 'POST' })
  .validator((input: { token: string }) => {
    const data = asObject(input)
    return { token: requireToken(data.token) }
  })
  .handler(async ({ data }) => resolveCapabilitiesByToken(data.token))
