import { createServerFn } from '@tanstack/react-start'
import { createProfile as createProfileInStore } from '../server/store.server'
import {
  asObject,
  requireProfileInput,
  requireToken,
} from './validation'

export const createProfile = createServerFn({ method: 'POST' })
  .validator((input: { token: string; isDefault?: boolean }) => {
    const data = asObject(input)
    return {
      token: requireToken(data.token),
      isDefault: data.isDefault === true,
      input: requireProfileInput(data),
    }
  })
  .handler(async ({ data }) =>
    createProfileInStore(data.token, data.input, {
      isDefault: data.isDefault,
    }),
  )
