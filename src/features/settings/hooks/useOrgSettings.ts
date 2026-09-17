/**
 * The Settings screen's data — one document, one query, one mutation.
 *
 * No list, no id: there is exactly one row, the same reasoning `useAuth`'s
 * `me()` query follows for "the signed-in user".
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as organizationApi from '@/api/organization'
import { snackbar } from '@/components'
import { toApiError } from '@/api/errors'
import type { OrgSettings } from '@/api/types'

const KEY = ['organization', 'settings'] as const

export function useOrgSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => organizationApi.retrieve(),
  })
}

export function useUpdateOrgSettings() {
  const queryClient = useQueryClient()
  return useMutation<OrgSettings, unknown, Partial<OrgSettings>>({
    mutationFn: (body) => organizationApi.update(body),
    onSuccess: (settings) => {
      queryClient.setQueryData(KEY, settings)
      snackbar.success('Settings saved')
    },
    onError: (error) => {
      snackbar.error('Could not save settings', toApiError(error).message)
    },
  })
}
