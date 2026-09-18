/**
 * Reason codes — F13, the master data behind every inventory adjustment.
 *
 * Maintained here rather than on the Adjustments screen for a permissions
 * reason that is easy to miss: the **leads** maintain this table, and the
 * leads cannot open Adjustments at all — that column is Finance's. Putting
 * the editor on the screen that consumes the codes would have put it behind a
 * door its own audience is refused.
 *
 * Settings is where it belongs: org-wide master data, one small table, a lead
 * gate that already matches.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as adjustmentsApi from '@/api/adjustments'
import { snackbar } from '@/components'
import { toApiError } from '@/api/errors'

/** Every code, active and retired — an editor has to see what it may revive. */
const KEY = ['reason-codes', 'all'] as const

export function useAllReasonCodes() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => adjustmentsApi.reasonCodes(),
    staleTime: 5 * 60 * 1000,
  })
}

/** Everything that reads a code has to be re-read when one changes. */
function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['reason-codes'] })
  void queryClient.invalidateQueries({ queryKey: ['adjustments'] })
}

export function useCreateReasonCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: adjustmentsApi.ReasonCodeInput) =>
      adjustmentsApi.createReasonCode(input),
    onSuccess: (code) => {
      invalidate(queryClient)
      snackbar.success(
        `${code.code} added`,
        code.direction === 'INCREASE'
          ? 'Adjustments against it will add to stock.'
          : 'Adjustments against it will remove from stock.',
      )
    },
    onError: (error) => snackbar.error('Could not add that code', toApiError(error).message),
  })
}

/**
 * Retire or revive a code.
 *
 * Never a delete: past adjustments point at it, and the direction it carries
 * is what makes their quantities readable years later.
 */
export function useSetReasonCodeActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      adjustmentsApi.updateReasonCode(id, { is_active: isActive }),
    onSuccess: (code) => {
      invalidate(queryClient)
      snackbar.success(
        code.is_active ? `${code.code} is available again` : `${code.code} retired`,
        code.is_active
          ? 'It can be chosen for new adjustments.'
          : 'It stays on every adjustment already posted, but cannot be chosen for new ones.',
      )
    },
    onError: (error) => snackbar.error('Could not change that code', toApiError(error).message),
  })
}
