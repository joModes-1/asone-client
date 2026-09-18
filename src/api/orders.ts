/**
 * School orders and the reports over them.
 *
 * The report endpoints are paginated, which is convenient for a dashboard:
 * `count` answers "how many" without fetching a single row.
 */

import { get, post } from './http'
import type {
  Invoice,
  OrderOnHold,
  PackingList,
  Page,
  PartProcessedOrder,
  SchoolOrder,
  SchoolOrderStatus,
  Shipment,
} from './types'

/** Orders placed but not yet paid for. */
export function ordersOnHold(params?: { page?: number }) {
  return get<Page<OrderOnHold>>('/orders/reports/on-hold/', params ?? undefined)
}

/**
 * Picked but not despatched — the shipping queue.
 *
 * `warehouse` narrows to one site, on top of the server's own row scoping —
 * what a lead uses to look at one warehouse's own queue instead of every
 * site's at once. Omit it for every site the role may see.
 */
export function ordersPartProcessed(params?: {
  warehouse?: number
  page?: number
  page_size?: number
}) {
  return get<Page<PartProcessedOrder>>('/orders/reports/part-processed/', params ?? undefined)
}

/**
 * Despatch history — every `Shipment` already created through `ship`/`fill`,
 * listable on its own rather than reached one order at a time.
 */
export function shipments(params?: {
  from_warehouse?: number
  order?: number
  page?: number
  page_size?: number
}) {
  return get<Page<Shipment>>('/orders/shipments/', params ?? undefined)
}

/**
 * Backorders outstanding.
 *
 * The report distinguishes what each one is waiting on: OPEN means nobody
 * has taken it, ASSIGNED means a warehouse has and has not shipped yet.
 * Different problems, so a tile should show the split rather than one total.
 */
export function outstandingBackorders(params?: { page?: number }) {
  return get<Page<Record<string, unknown>>>('/orders/reports/backorders/', params ?? undefined)
}

export function schoolOrders(params?: {
  status?: SchoolOrderStatus
  order_date?: string
  /** Leads only — School Staff never sends this, their own school is implicit. */
  school?: number
  page?: number
  /** Capped at 200 by the server's pagination class. */
  page_size?: number
}) {
  return get<Page<SchoolOrder>>('/orders/school-orders/', params ?? undefined)
}

/**
 * Place an order — F30, F31.
 *
 * `school` is deliberately not a field: the order belongs to the clerk's own
 * school, taken from their account. Sending one would invite a school to
 * order against somebody else's.
 *
 * `status` is not one either. Every order starts on Hold and only payment
 * confirmation moves it.
 *
 * Kits are exploded into their component SKUs on the way in, because a
 * warehouse picks garments and never "a kit" — and the components are
 * *stored*, so editing a kit next term does not change an order already
 * placed. Lines carry the price on the order date, so a reprinted invoice
 * still adds up.
 */
export interface PlaceOrderInput {
  student_name: string
  /** ISO date. Decides which prices the lines are costed at. */
  order_date: string
  kits?: { kit: number; quantity: number }[]
  skus?: { sku: number; quantity: number }[]
  notes?: string
}

export function placeOrder(body: PlaceOrderInput) {
  return post<SchoolOrder>('/orders/school-orders/', body)
}

export function schoolOrder(id: number) {
  return get<SchoolOrder>(`/orders/school-orders/${id}/`)
}

/**
 * The invoice, grouped by the kits the school chose.
 *
 * Every order has one from the moment it is placed — it is not a state the
 * order moves into, which is why there is no "invoiced" status.
 */
export function invoice(id: number) {
  return get<Invoice>(`/orders/school-orders/${id}/invoice/`)
}

/**
 * Confirm payment and release to the warehouse — F35.
 *
 * Releasing *is* the payment confirmation: the order records `released_at`
 * and a `payment_reference`. There is no separate paid state.
 */
export function releaseOrder(id: number, body?: { payment_reference?: string }) {
  return post<SchoolOrder>(`/orders/school-orders/${id}/release/`, body ?? {})
}

/**
 * The school says the parcel arrived — the second half of F41.
 *
 * The order becomes **Completed** only once every shipment on it is
 * confirmed. An order can have two: a backorder may ship direct from a
 * warehouse that is not the school's own (decision D2), so `shipment` may be
 * omitted only when there is exactly one.
 *
 * This does not touch stock. It left the shelf at ship and stays gone —
 * recording it here would mean goods already handed to a driver still
 * counting as the warehouse's.
 *
 * `notes` is for what was wrong: short, damaged, the wrong student. It is
 * recorded and nothing acts on it.
 */
export function confirmReceipt(
  id: number,
  body?: { shipment?: number; notes?: string },
) {
  return post<Shipment>(`/orders/school-orders/${id}/confirm-receipt/`, body ?? {})
}

/** Every despatch against an order. More than one is normal (D2). */
export function orderShipments(id: number) {
  return get<Shipment[]>(`/orders/school-orders/${id}/shipments/`)
}

/** Cancel an unpaid invoice. Cancelled, never deleted. */
export function cancelOrder(id: number, reason: string) {
  return post<SchoolOrder>(`/orders/school-orders/${id}/cancel/`, { reason })
}

/**
 * Packing lists — what the design calls the delivery slip.
 *
 * One per shipment, so an order that has not shipped returns an empty list.
 * The endpoint returns data, not a PDF: rendering and printing it is the
 * frontend's job.
 *
 * Leads and warehouse staff only. The checklist leaves the School Staff cell
 * blank on F40 — the likeliest reading being that a school gets the printed
 * sheet in the box rather than a screen.
 */
export function packingLists(id: number) {
  return get<PackingList[]>(`/orders/school-orders/${id}/packing-lists/`)
}
