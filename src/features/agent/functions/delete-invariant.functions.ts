import { createServerFn } from '@tanstack/react-start'
import { deleteInvariant as deleteInvariantInStore } from '../server/store.server'
import { asObject, requireInvariantId, requireToken } from './validation'

export const deleteInvariant = createServerFn({ method: 'POST' })
  .validator((input: { token: string; id: number }) => {
    const data = asObject(input)
    return { token: requireToken(data.token), id: requireInvariantId(data.id) }
  })
  .handler(async ({ data }) => ({ ok: await deleteInvariantInStore(data.token, data.id) }) as const)
