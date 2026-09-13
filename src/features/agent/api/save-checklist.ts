import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveChecklist } from '../functions/save-checklist.functions'
import { checklistQueryOptions } from './get-checklist'

export function useSaveChecklist(token: string, scenario: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: string[]) =>
      saveChecklist({ data: { token, scenario, items } }),
    onSuccess: (_result, items) => {
      queryClient.setQueryData(
        checklistQueryOptions(token, scenario).queryKey,
        items,
      )
    },
  })
}
