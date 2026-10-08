/**
 * Group orders — the consolidated seasonal requirement, and the comparison
 * against what the Tailoring Centers were actually asked for.
 *
 * ---------------------------------------------------------------------------
 * Why this is its own feature rather than part of `production`
 * ---------------------------------------------------------------------------
 * A group order is the parent document: production orders break it down, one
 * per warehouse per centre. They share the `procurement` app on the server and
 * sit beside each other in the menu, but they answer different questions —
 * "what does the season need" against "what has this centre been asked to
 * make" — and the screens have almost nothing in common past the line editor.
 *
 * ---------------------------------------------------------------------------
 * Writing is leads only
 * ---------------------------------------------------------------------------
 * `MasterDataAccess` on the server, which is the **Table Updates** column:
 * Program Lead and Operations Manager. Finance reads. Warehouse and school
 * staff have no access at all, so the nav entry is hidden rather than left to
 * 403 — the same rule every other entry follows.
 *
 * `canRaiseProductionOrder` in `domain/access` already names that column, and
 * is reused here rather than duplicated: a second predicate reading the same
 * cell is a second thing to forget when AsOne moves it.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as procurement from '@/api/procurement'
import { keys } from '@/api/keys'
import { snackbar } from '@/components'
import { toApiError } from '@/api/errors'
import { LIST_PAGE_SIZE } from '@/api/pageSize'
import { useSkuOptions } from '@/features/catalog/hooks/useSkuOptions'

export const GROUP_ORDER_PAGE_SIZE = LIST_PAGE_SIZE

export function useGroupOrders(page: number, status: string | null) {
  return useQuery({
    queryKey: keys.groupOrders(status, page),
    queryFn: () =>
      procurement.groupOrders({
        page,
        page_size: GROUP_ORDER_PAGE_SIZE,
        ...(status ? { status } : {}),
      }),
    // Paging should not blank the table it is paging.
    placeholderData: keepPreviousData,
  })
}

/** One group order, with its lines. */
export function useGroupOrder(id: number) {
  return useQuery({
    queryKey: keys.groupOrder(id),
    queryFn: () => procurement.groupOrder(id),
  })
}

/**
 * Requested against ordered, per SKU.
 *
 * The point of the detail screen. Fetched as its own query rather than folded
 * into the order, because it goes stale for a different reason: a *production*
 * order being raised, amended or cancelled changes these numbers while the
 * group order itself has not moved.
 */
export function useGroupOrderReconciliation(id: number) {
  return useQuery({
    queryKey: keys.groupOrderReconciliation(id),
    queryFn: () => procurement.groupOrderReconciliation(id),
  })
}

/** Every active SKU, for the line picker. Shared with production orders. */
export function useOrderableSkus(enabled = true) {
  return useSkuOptions(enabled)
}

export function useCreateGroupOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: procurement.GroupOrderInput) => procurement.createGroupOrder(body),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['group-orders'] })
      snackbar.success(
        `${order.number} raised`,
        `${order.total_quantity} units across ${order.lines.length} line${
          order.lines.length === 1 ? '' : 's'
        }.`,
      )
    },
    /*
     * Reported verbatim rather than through the shared handler's generic
     * wording. The one failure worth reading is an unpriced garment: the
     * server refuses the whole order and *names the garment*, which is the
     * difference between a lead fixing a price in a minute and re-keying
     * forty lines to find out which one was wrong.
     */
    onError: (error) => {
      snackbar.error('That group order was not created', toApiError(error).message)
    },
  })
}

/**
 * Close or cancel a group order.
 *
 * Cancelling is a status change, never a delete — the document is what funded
 * the Tailoring Centers, so it has to survive being withdrawn, and the
 * production orders underneath it still point at it.
 */
export function useAmendGroupOrder(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: procurement.GroupOrderAmendment) =>
      procurement.amendGroupOrder(id, body),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['group-orders'] })
      snackbar.success(`${order.number} is now ${order.status_display.toLowerCase()}`)
    },
    onError: (error) => {
      snackbar.error('That change was not saved', toApiError(error).message)
    },
  })
}
