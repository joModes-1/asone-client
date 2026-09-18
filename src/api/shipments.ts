/**
 * Shipments — F41, and F42's consolidated despatch.
 *
 * **Nothing here creates a shipment by POSTing a row.** A shipment is what
 * `despatch` produces, and that call moves stock out of the ledger in the
 * same transaction. A list endpoint that accepted writes would let a client
 * claim goods left the building without the stock ever moving, which is the
 * one thing the ledger exists to prevent — so the list is read-only and
 * despatching has its own route.
 */

import { get, post } from './http'
import type {
  Page,
  PackingList,
  PickingQueueRow,
  PickingSummary,
  ReadyToDespatch,
  Shipment,
} from './types'

/*
 * A type alias, not an interface, and that is load-bearing: TypeScript gives
 * implicit index signatures to aliases but not to interfaces, so an
 * interface here is not assignable to the transport's `QueryParams`.
 */
export type ShipmentFilters = {
  school?: number
  /** SHIPPED — left, not yet confirmed. DELIVERED — the school confirmed it. */
  status?: 'SHIPPED' | 'DELIVERED'
  from_warehouse?: number
  /** Both ends inclusive, as a person means when they ask for August. */
  shipped_from?: string
  shipped_to?: string
  search?: string
  page?: number
  page_size?: number
}

export function shipments(params?: ShipmentFilters) {
  return get<Page<Shipment>>('/orders/shipments/', params ?? undefined)
}

export function shipment(id: number) {
  return get<Shipment>(`/orders/shipments/${id}/`)
}

/**
 * Schools with orders picked and waiting — F42's despatch queue.
 *
 * Grouped by school because the van is per school. A warehouse clerk is
 * pinned to their own site and passes nothing; an all-locations role must
 * say which warehouse they are despatching from.
 */
export function despatchQueue(warehouse?: number | null) {
  return get<ReadyToDespatch[]>(
    '/orders/despatch/queue/',
    warehouse ? { warehouse } : undefined,
  )
}

export interface DespatchInput {
  school: number
  /** Omit to send every picked order waiting for that school. */
  orders?: number[]
  from_warehouse?: number
  shipped_on?: string
  waybill_number?: string
  notes?: string
}

/**
 * Send a school's picked orders out on one van — F42.
 *
 * Refused if an order is not picked, is cancelled, or belongs to another
 * school: a clerk who asked for it to go needs to know it did not, rather
 * than find it left behind.
 */
export function despatch(body: DespatchInput) {
  return post<Shipment>('/orders/despatch/', body)
}

export interface PickingQueue {
  /** Counts the whole queue, not the page — "12 ready" means twelve. */
  summary: PickingSummary
  orders: Page<PickingQueueRow>
}

/**
 * The picking backlog — F38, the shipping screen's landing view.
 *
 * A warehouse clerk is pinned to their own site by the server and passes
 * nothing; an all-locations role may narrow with `warehouse`.
 */
export type PickingStatus = 'RELEASED' | 'PICKED'

export function pickingQueue(params?: {
  warehouse?: number | null
  /**
   * One bucket of the backlog: RELEASED is still to pick, PICKED is off the
   * shelf and waiting for a van. Omitted for both.
   *
   * The two tiles above the table are deliberately unaffected — they are the
   * totals the filter is chosen from, so a tile that changed when you
   * narrowed the table would remove the only thing saying what you narrowed.
   */
  status?: PickingStatus | null
  page?: number
  page_size?: number
}) {
  const { warehouse, status, ...rest } = params ?? {}
  return get<PickingQueue>('/orders/picking/queue/', {
    ...rest,
    ...(warehouse ? { warehouse } : {}),
    ...(status ? { status } : {}),
  })
}

/** Reserve an order's stock — F39. Atomic: picked, or not picked. */
export function pickOrder(orderId: number) {
  return post<unknown>(`/orders/school-orders/${orderId}/pick/`, {})
}

/**
 * Put a mistakenly picked order back on the shelf — the undo for F39.
 *
 * Posts the offsetting ledger pair rather than deleting anything: the ledger
 * is append-only, so the history reads as picked, then put back. Refused
 * once the order has shipped — stock that has left the building comes back
 * as a return, not by undoing a pick.
 */
export function unpickOrder(orderId: number, reason?: string) {
  return post<unknown>(`/orders/school-orders/${orderId}/unpick/`, { reason })
}

/** The document that travels with the goods — F40, per order. */
export function packingListsForOrder(orderId: number) {
  return get<PackingList[]>(`/orders/school-orders/${orderId}/packing-lists/`)
}
