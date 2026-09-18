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
