/**
 * Production orders — reading the queue, and raising a new one.
 *
 * Raising one is the **Table Updates** column, which AsOne gives to the two
 * leads alone. A warehouse clerk reads this list and receives against it but
 * cannot create — `canRaiseProductionOrder` in `domain/access` is the same
 * rule the server's `MasterDataAccess` applies to writes.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as catalog from '@/api/catalog'
import * as procurement from '@/api/procurement'
import { snackbar } from '@/components'
import { toApiError } from '@/api/errors'
import { useSkuOptions } from '@/features/catalog/hooks/useSkuOptions'
import { LIST_PAGE_SIZE } from '@/api/pageSize'

const PAGE_SIZE = LIST_PAGE_SIZE

export interface ProductionFilters {
  /** Matches the PO number. Applied on the client — see the screen. */
  search: string
  tailoringCenter: number | null
  warehouse: number | null
  status: string | null
}

export function useProductionOrders(page: number, filters: ProductionFilters) {
  return useQuery({
    queryKey: [
      'production-orders',
      'list',
      page,
      filters.status,
      filters.tailoringCenter,
      filters.warehouse,
    ],
    queryFn: () =>
      procurement.productionOrders({
        page,
        page_size: PAGE_SIZE,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.tailoringCenter ? { tailoring_center: filters.tailoringCenter } : {}),
        ...(filters.warehouse ? { warehouse: filters.warehouse } : {}),
      }),
    // Paging should not blank the table it is paging.
    placeholderData: keepPreviousData,
  })
}

export const PRODUCTION_PAGE_SIZE = PAGE_SIZE

/** Tailoring centers, for the filter and the picker. Master data, cached hard. */
export function useTailoringCenters() {
  return useQuery({
    queryKey: ['tailoring-centers'],
    queryFn: () => catalog.tailoringCenters(),
    staleTime: 10 * 60 * 1000,
  })
}

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: () => catalog.warehouses(),
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * Every active SKU, for the line picker.
 *
 * Fetched whole rather than searched: AsOne's catalogue is tens of SKUs, not
 * thousands, and a picker that has them all can be typed into without a
 * round trip per keystroke. `page_size` is capped at 200 by the server.
 */
export function useOrderableSkus(enabled = true) {
  // Only the leads can raise an order, so only they need the picker's
  // catalogue. Fetching it for every clerk who opens the list is 200 rows
  // nobody will look at — hence the flag, which the shared hook honours.
  return useSkuOptions(enabled)
}

/** One order, with its lines — the detail screen. */
export function useProductionOrder(id: number) {
  return useQuery({
    queryKey: ['production-orders', 'detail', id],
    queryFn: () => procurement.productionOrder(id),
  })
}

/** Ordered / shipped / received / outstanding per SKU — the manifest table. */
export function useOrderOutstanding(id: number) {
  return useQuery({
    queryKey: ['production-orders', 'outstanding', id],
    queryFn: () => procurement.outstandingOnOrder(id),
  })
}

/** Every receipt against an order — the history log. */
export function useOrderReceipts(id: number) {
  return useQuery({
    queryKey: ['receipts', 'for-order', id],
    queryFn: () => procurement.receipts({ production_order: id }),
  })
}

export function useCreateProductionOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: procurement.ProductionOrderInput) =>
      procurement.createProductionOrder(body),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      snackbar.success(
        `${order.number} raised on ${order.tailoring_center_name}`,
        `${order.total_quantity} units due into ${order.warehouse_name}.`,
      )
    },
    // Failure is reported by the shared mutation handler.
  })
}

/**
 * Cancel a production order — F18.
 *
 * Its own hook rather than a general "amend", because cancelling is the only
 * amendment the screens offer and it is the one with consequences: the order
 * stops counting towards what the Tailoring Centres owe, and towards what
 * every low-stock decision assumes is already on its way.
 *
 * The server refuses to cancel an order goods have arrived against. That
 * refusal is surfaced verbatim — it names the quantity received and says to
 * close the order instead, which is more use than "could not cancel".
 */
export function useCancelProductionOrder(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => procurement.amendProductionOrder(id, { status: 'CANCELLED' }),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
      // The open-orders list feeds Receiving; a cancelled order must stop
      // offering itself as something to receive against.
      void queryClient.invalidateQueries({ queryKey: ['receiving'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      snackbar.success(`${order.number} cancelled`, 'It no longer counts as stock on its way.')
    },
    onError: (error) => {
      const failure = toApiError(error)
      snackbar.error('That order cannot be cancelled', failure.message)
    },
  })
}

/**
 * Post a receipt that was recorded but never committed to the ledger — F21.
 *
 * Receiving writes the receipt and posts it in two calls. When the second
 * fails, the first has already succeeded: a numbered receipt exists, the
 * warehouse believes it recorded the delivery, and **no stock was raised**.
 *
 * The message shown at the time says to post it from the receipt — and until
 * now there was nowhere to do that, so the instruction named an action the UI
 * could not perform. This is that action.
 *
 * Rare, but the failure mode is the expensive one: stock physically on the
 * shelf that the system does not know about, which every availability check,
 * low-stock alert and pick decision is then wrong about.
 */
export function usePostReceipt() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (receiptId: number) => procurement.postReceipt(receiptId),
    onSuccess: (receipt) => {
      // Stock moved, so everything counting it is stale.
      void queryClient.invalidateQueries({ queryKey: ['receipts'] })
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['movements'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      snackbar.success(
        `${receipt.number} posted to inventory`,
        'Stock has been raised at the receiving warehouse.',
      )
    },
    onError: (error) => {
      snackbar.error('Could not post that receipt', toApiError(error).message)
    },
  })
}
