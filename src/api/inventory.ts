/**
 * Inventory.
 *
 * Stock levels and reorder alerts return bare arrays, not paginated
 * envelopes — they are computed reports, not tables. The movement ledger is
 * paginated like everything else.
 */

import { get } from './http'
import type { MovementType, Page, ReorderAlert, StockLevel, StockMovement } from './types'

/**
 * A type alias, not an interface: TypeScript gives object type aliases an
 * implicit index signature, which is what lets them satisfy the transport's
 * `QueryParams` record. An interface would not.
 */
type WarehouseScoped = {
  /** Omit for every warehouse the role may see. */
  warehouse?: number | null
  as_of?: string
}

/**
 * Every SKU's level at every warehouse the caller may see, summed from the
 * ledger on read. There is no stored quantity to go stale.
 */
export function stockLevels(params?: WarehouseScoped & { include_zero?: boolean }) {
  return get<StockLevel[]>('/inventory/stock-levels/', params ?? undefined)
}

/** Where a level has fallen below its configured minimum. */
export function reorderAlerts(params?: WarehouseScoped) {
  return get<ReorderAlert[]>('/inventory/reorder-alerts/', params ?? undefined)
}

/**
 * The append-only ledger, newest first — F48, the audit trail.
 *
 * Every filter here is applied by the server, which matters more on this
 * endpoint than on any other: a history narrowed on the client would be a
 * page of the ledger pretending to be the ledger, and the whole point of an
 * audit trail is that what it shows is what there is.
 */
export function movements(params?: {
  warehouse?: number | null
  sku?: number
  movement_type?: MovementType
  document_number?: string
  /** Inclusive `YYYY-MM-DD` bounds on the date it happened. Either may stand alone. */
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}) {
  return get<Page<StockMovement>>('/inventory/movements/', params ?? undefined)
}
