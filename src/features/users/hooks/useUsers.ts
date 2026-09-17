/**
 * The Users tab's data: the staff list, and creating a new account.
 *
 * `page_size` is left at the server default rather than fixed here, unlike
 * `useOrders` — the Users list is small enough (tens, not hundreds) that
 * paging it the way the order ledger does would be premature.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as usersApi from '@/api/users'
import { snackbar } from '@/components'
import { toApiError } from '@/api/errors'
import type { CreatedUser } from '@/api/users'
import type { UserAdmin, UserCreate } from '@/api/types'

export function useUsers() {
  return useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => usersApi.list(),
  })
}

/** One account — the detail screen reached from a Users row. */
export function useUser(id: number) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.retrieve(id),
    enabled: Number.isFinite(id),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation<CreatedUser, unknown, UserCreate>({
    mutationFn: (input) => usersApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
    },
  })
}

/**
 * Activate or deactivate an account — the Status dropdown's two options,
 * on the table and on the detail screen alike.
 *
 * Both invalidate the same two keys: the list (so the table's status dot
 * updates) and the one detail record (so the banner does too), whichever of
 * the two the caller happens to be on.
 */
function onActiveChanged(queryClient: ReturnType<typeof useQueryClient>, user: UserAdmin) {
  void queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
  void queryClient.invalidateQueries({ queryKey: ['users', user.id] })
}

/**
 * A failed activate/deactivate has to be visible — the dropdown closes the
 * instant an option is chosen (see `StatusDropdown`), so a silent failure
 * looks exactly like "nothing happened" rather than "that was refused".
 * The most common cause is `_guard_self`: a lead cannot deactivate their
 * own account, which the server reports as a 403.
 */
function onActiveChangeFailed(error: unknown) {
  snackbar.error('Could not update that account', toApiError(error).message)
}

export function useActivateUser() {
  const queryClient = useQueryClient()
  return useMutation<UserAdmin, unknown, number>({
    mutationFn: (id) => usersApi.activate(id),
    onSuccess: (user) => onActiveChanged(queryClient, user),
    onError: onActiveChangeFailed,
  })
}

export function useDeactivateUser() {
  const queryClient = useQueryClient()
  return useMutation<UserAdmin, unknown, number>({
    mutationFn: (id) => usersApi.deactivate(id),
    onSuccess: (user) => onActiveChanged(queryClient, user),
    onError: onActiveChangeFailed,
  })
}

/** Edit Profile on the detail screen — name, email, phone. Not role or
 * site: those are the Add User / registration decision, made once. */
export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation<UserAdmin, unknown, { id: number; body: Partial<UserAdmin> }>({
    mutationFn: ({ id, body }) => usersApi.update(id, body),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['users', user.id] })
    },
  })
}
