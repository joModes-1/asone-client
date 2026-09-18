/**
 * The dashboard's own API.
 *
 * A read-only aggregation app on the server, and the right source for this
 * screen — its README is explicit: "If a figure here disagrees with the
 * screen it came from, the other screen is right and this one has a bug."
 *
 * Worth using rather than adding up the underlying resources on the client,
 * for three reasons the client version got wrong:
 *
 *   Totals are computed server-side, so money is read rather than summed —
 *   which is what the brief asks for.
 *
 *   `order-volume/` is readable by the reporting roles. Counting orders per
 *   day from `/orders/school-orders/` is not: that endpoint answers 403 for
 *   both leads.
 *
 *   Every figure is one request instead of a page-capped roll-up.
 */

import { get, http } from './http'
import type {
  ActivityEvent,
  AttentionAlert,
  DashboardSummary,
  InventoryByWarehouse,
  NotificationFeed,
  OrderVolume,
  SchoolDashboard,
  WeeklyReport,
} from './types'

/** `warehouse` narrows every figure to one site; omit for all of them. */
type Scoped = { warehouse?: number | null }

/**
 * The school's own dashboard — the other half of F62.
 *
 * Not this file's other endpoints with a `?school=`: those are warehouse
 * figures, and a school has no warehouse. It reads the caller's own school
 * and takes no parameters, so there is nothing to scope on the client.
 *
 * One request rather than four, because unlike the warehouse dashboard none
 * of these panels is separately forbidden — they are all the same school's
 * rows.
 */
export function schoolDashboard() {
  return get<SchoolDashboard>('/dashboard/school/')
}

/** The KPI row: units, value, pick queue, dispatch queue, backorders, low stock. */
export function summary(params?: Scoped) {
  return get<DashboardSummary>('/dashboard/summary/', params ?? undefined)
}

/** What needs looking at, already worded and graded by the server. */
export function attention(params?: Scoped) {
  return get<AttentionAlert[]>('/dashboard/attention/', params ?? undefined)
}

/** Recent activity across receipts, orders, adjustments and production. */
export function activity(params?: Scoped & { limit?: number }) {
  return get<ActivityEvent[]>('/dashboard/activity/', params ?? undefined)
}

/** Orders per day, with the total and daily average. */
export function orderVolume(params?: Scoped & { from?: string; to?: string }) {
  return get<OrderVolume>('/dashboard/order-volume/', params ?? undefined)
}

/**
 * The bell for a warehouse role: a count and the messages behind it.
 *
 * School Staff are refused this one — a school holds no stock, so most of
 * what it reports is about somebody else's building. They have
 * {@link schoolNotifications} instead.
 */
export function notifications(params?: Scoped) {
  return get<NotificationFeed>('/dashboard/notifications/', params ?? undefined)
}

/**
 * The bell for a school. Same shape, so one component draws both.
 *
 * No `warehouse` parameter and no `school` one: it is scoped to the caller's
 * own school, exactly as their dashboard is. The rows are things a school can
 * *act on* — a parcel to confirm, an invoice to pay, a backorder to expect —
 * and confirming a delivery is theirs alone, which is why hiding the bell
 * from them left the only role with a personal to-do list with nowhere to
 * read it.
 */
export function schoolNotifications() {
  return get<NotificationFeed>('/dashboard/school/notifications/')
}

/** Units and value per warehouse, with totals. */
export function inventoryByWarehouse(params?: Scoped) {
  return get<InventoryByWarehouse>('/dashboard/inventory-by-warehouse/', params ?? undefined)
}

/** The week's movement summary — what the banner announces. */
export function weeklyReport(params?: Scoped & { from?: string; to?: string }) {
  return get<WeeklyReport>('/dashboard/weekly-report/', params ?? undefined)
}

/**
 * Fetch the weekly report as a file.
 *
 * Not a plain `<a href>`, for two reasons: the path is relative to the API,
 * not the app's own origin, and the endpoint needs the bearer token, which
 * an anchor cannot send. Putting the token in a query string would leak it
 * into browser history and server logs.
 *
 * So it goes through the transport like every other request and comes back
 * as a blob the caller can hand to the browser.
 */
export async function downloadWeeklyReport(params?: Scoped & { from?: string; to?: string }) {
  const response = await http.get('/dashboard/weekly-report/download/', {
    params: params ?? undefined,
    responseType: 'blob',
  })

  // The server names the file in Content-Disposition; fall back to something
  // sensible rather than "download".
  const disposition = String(response.headers['content-disposition'] ?? '')
  const match = /filename="?([^"';]+)"?/i.exec(disposition)

  return {
    blob: response.data as Blob,
    filename: match?.[1] ?? 'asone-weekly-report.csv',
  }
}
