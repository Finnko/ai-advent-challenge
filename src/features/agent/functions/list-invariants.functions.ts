import { createServerFn } from '@tanstack/react-start'
import { listInvariants as listInvariantsInStore } from '../server/store.server'
import { asObject, requireToken } from './validation'

export const listInvariants = createServerFn({ method: 'POST' })
  .validator((input: { token: string }) => {
    const data = asObject(input)
    return { token: requireToken(data.token) }
  })
  .handler(async ({ data }) => listInvariantsInStore(data.token))
