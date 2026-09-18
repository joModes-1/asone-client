/**
 * Shipments data.
 *
 * Despatching is the only mutation, and it is the irreversible one: it moves
 * stock out of the ledger. Everything else here is a read.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as shipmentsApi from '@/api/shipments'
import { snackbar } from '@/components'
import { LIST_PAGE_SIZE } from '@/api/pageSize'

export const SHIPMENTS_PAGE_SIZE = LIST_PAGE_SIZE

export function useShipments(page: number, filters: shipmentsApi.ShipmentFilters) {
  return useQuery({
    queryKey: ['shipments', 'list', page, filters],
    queryFn: () =>
      shipmentsApi.shipments({ ...filters, page, page_size: SHIPMENTS_PAGE_SIZE }),
    // Paging should not blank the table it is paging.
    placeholderData: keepPreviousData,
  })
}

export function useShipment(id: number) {
  return useQuery({
    queryKey: ['shipments', 'detail', id],
    queryFn: () => shipmentsApi.shipment(id),
  })
}

/**
 * How many backlog rows a page holds.
 *
 * Ten rather than the fifteen every other list uses, because this is a
 * working queue rather than a record to read: a clerk takes the top of it to
 * the shelves, and a page they can hold in their head is worth more here
 * than one that shows more at once.
 */
export const PICKING_PAGE_SIZE = LIST_PAGE_SIZE

/** The picking backlog — F38, the shipping screen's landing view. */
export function usePickingQueue(
  warehouseId: number | null,
  page: number,
  status: shipmentsApi.PickingStatus | null = null,
) {
  return useQuery({
    queryKey: ['shipments', 'picking-queue', warehouseId, page, status],
    queryFn: () =>
      shipmentsApi.pickingQueue({
        warehouse: warehouseId,
        status,
        page,
        page_size: PICKING_PAGE_SIZE,
      }),
    // Paging should not blank the table it is paging.
    placeholderData: keepPreviousData,
  })
}

/**
 * Reserve an order's stock — F39.
 *
 * Atomic on the server: an order is picked or it is not. There is no
 * half-picked state to resume, because a partial reservation would let the
 * ledger say stock is committed to an order nobody finished.
 */
export function usePickOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderId: number) => shipmentsApi.pickOrder(orderId),
    onSuccess: () => {
      // Stock moved from Available into Pick, so everything counting it is
      // stale — including the backlog this was started from.
      void queryClient.invalidateQueries({ queryKey: ['shipments'] })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      snackbar.success('Picked', 'Stock is reserved and the order is ready for a van.')
    },
  })
}

/**
 * Undo a pick.
 *
 * The safety net under a one-click, stock-moving action. Invalidates the
 * same keys picking does, because it moves the same stock the other way.
 */
export function useUnpickOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number; reason?: string }) =>
      shipmentsApi.unpickOrder(orderId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shipments'] })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      snackbar.success(
        'Pick undone',
        'The stock is back on the shelf and free for another order.',
      )
    },
  })
}

/** Schools with orders picked and waiting. */
export function useDespatchQueue(warehouseId: number | null) {
  return useQuery({
    queryKey: ['shipments', 'despatch-queue', warehouseId],
    queryFn: () => shipmentsApi.despatchQueue(warehouseId),
  })
}

export function useDespatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: shipmentsApi.DespatchInput) => shipmentsApi.despatch(body),
    onSuccess: (shipment) => {
      // Stock left the building, so everything counting it is stale.
      void queryClient.invalidateQueries({ queryKey: ['shipments'] })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      const orders = shipment.order_count
      snackbar.success(
        `${shipment.number} despatched to ${shipment.school_name}`,
        `${orders} order${orders === 1 ? '' : 's'} · ${shipment.total_quantity} garments on the van.`,
      )
    },
    // Failure is reported by the shared mutation handler.
  })
}
