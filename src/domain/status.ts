/**
 * Which tone a status gets.
 *
 * Pure mapping, kept out of the components so it can be asserted in a test
 * and so one status never picks up two different colours on two screens.
 *
 * The label always comes from the server's `*_display` field — never
 * reconstructed here — because the server owns the wording.
 */

import type { Tone } from '@/components'
import type { MovementType, ProcurementStatus, SchoolOrderStatus } from '@/api/types'
import { paths } from '@/routes/paths'

/**
 * School order lifecycle.
 *
 * `RELEASED` is deliberately neutral, not a success tone. The status exists
 * in the enum but no server code path reaches it — what confirms payment is
 * an open question with AsOne — so nothing in the UI should present it as an
 * achieved state.
 */
export function schoolOrderTone(status: SchoolOrderStatus): Tone {
  switch (status) {
    case 'HOLD':
      return 'warning'
    case 'PICKED':
      return 'info'
    case 'SHIPPED':
      return 'info'
    case 'COMPLETED':
      return 'success'
    case 'CANCELLED':
      return 'error'
    case 'RELEASED':
      return 'neutral'
  }
}

export function procurementTone(status: ProcurementStatus): Tone {
  switch (status) {
    case 'OPEN':
      return 'info'
    case 'CLOSED':
      return 'success'
    case 'CANCELLED':
      return 'error'
  }
}

/** Ledger movements: does this row add stock or remove it? */
export function movementTone(type: MovementType): Tone {
  switch (type) {
    case 'RECEIPT':
    case 'TRANSFER_IN':
    case 'RETURN':
      return 'success'
    case 'PICK':
    case 'SHIPMENT':
    case 'TRANSFER_OUT':
      return 'info'
    case 'DAMAGE':
      return 'error'
    case 'ADJUSTMENT':
      return 'warning'
  }
}

/**
 * The order lifecycle, as the server models it.
 *
 * Five steps, not the seven the design draws. `INVOICED` and `PAID` are not
 * statuses:
 *
 *   Invoiced   every order has an invoice from the moment it is placed, so
 *              it is not a state to move into.
 *   Paid       releasing *is* the payment confirmation — the order carries
 *              `released_at` and `payment_reference`.
 *
 * `SHIPPED` and `COMPLETED` are both here and both matter. Shipped means it
 * left the warehouse; completed means the school says it arrived. The gap
 * between them is where a lost parcel shows up — collapse them and a
 * delivery that never turned up looks exactly like one that did.
 *
 * `CANCELLED` is deliberately not in the trail. It is an exit, not a step,
 * and drawing it in sequence implies every order passes through it.
 */
export const ORDER_TRAIL: readonly SchoolOrderStatus[] = [
  'HOLD',
  'RELEASED',
  'PICKED',
  'SHIPPED',
  'COMPLETED',
]

/** Human label for a trail step. */
export const ORDER_STEP_LABELS: Record<SchoolOrderStatus, string> = {
  HOLD: 'Hold',
  RELEASED: 'Released',
  PICKED: 'Picking',
  SHIPPED: 'Shipped',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

/**
 * How far along an order is, as an index into ORDER_TRAIL.
 *
 * Cancelled returns -1: it has no position, and giving it one would place it
 * somewhere on a line it never travelled.
 */
export function orderTrailPosition(status: SchoolOrderStatus): number {
  return ORDER_TRAIL.indexOf(status)
}

/**
 * Whether an order has been paid for.
 *
 * Derived, because the server has no payment field. Releasing an order *is*
 * the payment confirmation — `release_order()` records who confirmed it and
 * when — so `released_at` is the fact behind this badge. Nothing is invented:
 * an unreleased order simply has not been paid yet.
 */
export function paymentLabel(order: {
  status: SchoolOrderStatus
  released_at: string | null
}): string {
  if (order.status === 'CANCELLED') return 'Void'
  return order.released_at ? 'Paid' : 'Unpaid'
}

export function paymentTone(order: {
  status: SchoolOrderStatus
  released_at: string | null
}): Tone {
  if (order.status === 'CANCELLED') return 'neutral'
  return order.released_at ? 'success' : 'warning'
}

/**
 * The severity the dashboard's attention feed reports.
 *
 * The server grades each alert — CRITICAL, HOLD, and so on — and this only
 * picks how that looks. Unknown levels fall back to neutral rather than
 * throwing: the server may add one, and a new alert kind should not blank
 * the panel.
 */
export function alertTone(level: string): Tone {
  switch (level.toUpperCase()) {
    case 'CRITICAL':
      return 'error'
    case 'WARNING':
    case 'HOLD':
      return 'warning'
    case 'READY':
    case 'INFO':
      return 'info'
    default:
      return 'neutral'
  }
}

/**
 * Where an attention alert's "kind" leads.
 *
 * The server's `message` says what is wrong; this says where to go do
 * something about it. `null` means there is no single screen for it yet —
 * the row still renders, just not as a link.
 *
 * `registrations_pending` is one alert per request (see
 * `dashboard/services.py::needs_attention`), so `refId` opens straight into
 * that person's own Approve/Decline review rather than just the Users
 * screen — the same as clicking that row on the Users table itself.
 */
export function alertPath(kind: string, refId?: number | null): string | null {
  switch (kind) {
    case 'low_stock':
      return paths.stockReport
    case 'orders_on_hold':
      return paths.orders
    case 'receipts_unreconciled':
      return paths.receiving
    case 'backorders_fillable':
      return paths.backorders
    case 'registrations_pending':
      return refId ? `${paths.users}?review=${refId}` : paths.users

    /*
      The school's own kinds. Each lands where the school can act: a single
      parcel opens the order it belongs to, because that is where Confirm
      Delivery Received lives; several stay a rollup and go to the list.
    */
    case 'deliveries_to_confirm':
      return refId ? `${paths.orders}/${refId}` : paths.orders
    case 'school_orders_unpaid':
      return paths.orders
    case 'school_backorders':
      return paths.orders
    default:
      return null
  }
}

/**
 * The kind of thing that happened, in the activity feed.
 *
 * Same reasoning: the server names the kind, this picks the colour, and an
 * unfamiliar kind gets a neutral dot instead of an exception.
 */
export function activityTone(kind: string): Tone {
  switch (kind) {
    case 'receipt':
    case 'return':
      return 'success'
    case 'order':
    case 'shipment':
    case 'production_order':
      return 'info'
    case 'adjustment':
    case 'transfer':
      return 'warning'
    case 'backorder':
      return 'error'
    default:
      return 'neutral'
  }
}

/**
 * A stock figure against its minimum.
 *
 * Both numbers come from the server; this only chooses how to show the
 * comparison.
 */
export function stockTone(level: number, minimum: number | null): Tone {
  if (level <= 0) return 'error'
  if (minimum !== null && level < minimum) return 'warning'
  return 'success'
}
