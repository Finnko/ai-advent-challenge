import { createServerFn } from '@tanstack/react-start'
import { createInvariant as createInvariantInStore } from '../server/store.server'
import { asObject, requireInvariantInput, requireToken } from './validation'

export const createInvariant = createServerFn({ method: 'POST' })
  .validator((input: { token: string }) => {
    const data = asObject(input)
    return { token: requireToken(data.token), input: requireInvariantInput(data) }
  })
  .handler(async ({ data }) => createInvariantInStore(data.token, data.input))
