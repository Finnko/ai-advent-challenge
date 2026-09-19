import { createServerFn } from '@tanstack/react-start'
import { updateInvariant as updateInvariantInStore } from '../server/store.server'
import { asObject, requireInvariantId, requireInvariantUpdate, requireToken } from './validation'

export const updateInvariant = createServerFn({ method: 'POST' })
  .validator((input: { token: string; id: number }) => {
    const data = asObject(input)
    return { token: requireToken(data.token), id: requireInvariantId(data.id), input: requireInvariantUpdate(data) }
  })
  .handler(async ({ data }) => updateInvariantInStore(data.token, data.id, data.input))
