import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveChecklist as saveChecklistFn } from '../functions/save-checklist.functions'
import { checklistQueryOptions } from './get-checklist'

export type SaveChecklistInput = {
  token: string
  scenario: string
  items: string[]
}

export const saveChecklist = (input: SaveChecklistInput) =>
  saveChecklistFn({ data: input })

export function useSaveChecklist() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (_result, vars) => {
      queryClient.setQueryData(
        checklistQueryOptions(vars.token, vars.scenario).queryKey,
        vars.items,
      )
    },
    mutationFn: saveChecklist,
  })
}
