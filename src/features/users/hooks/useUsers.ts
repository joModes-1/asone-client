/**
 * The Users tab's data: the staff list, and creating a new account.
 *
 * Paged, at the same size as every other list screen. It was unpaged on the
 * reasoning that tens of accounts do not need it — true of the accounts, but
 * the tab also carries every pending registration request above them, and
 * those are not bounded by how many people AsOne employs.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as usersApi from '@/api/users'
import type { CreatedUser } from '@/api/users'
import type { UserCreate } from '@/api/types'
import { LIST_PAGE_SIZE } from '@/api/pageSize'

/**
 * Rows per page.
 *
 * Sent to the server as well as used to size the footer. It was only ever
 * used for the footer, and the server's own default is fifty — so the two
 * disagreed, every account came back on one page, and the controls never
 * appeared no matter how many accounts there were.
 *
 * Ten rather than fifteen to match the picking backlog. Both are lists
 * somebody works down rather than reads, and AsOne has fourteen accounts:
 * at fifteen the fix above would have been invisible, because one page is
 * all there is.
 */
export const USERS_PAGE_SIZE = LIST_PAGE_SIZE

export function useUsers(page = 1) {
  return useQuery({
    queryKey: ['users', 'list', page],
    queryFn: () => usersApi.list({ page, page_size: USERS_PAGE_SIZE }),
    // Paging should not blank the table it is paging.
    placeholderData: keepPreviousData,
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
