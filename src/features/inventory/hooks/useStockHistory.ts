/**
 * The stock ledger, paged — F48.
 *
 * Every filter goes to the server. That is not a preference on this screen:
 * a history narrowed on the client is a page of the ledger pretending to be
 * the ledger, and "no rows" would mean "none on this page" while reading as
 * "this never happened". An audit trail that can mislead about absence is
 * worse than no audit trail.
 *
 * `keepPreviousData` so paging does not blank the table between requests —
 * the same as adjustments and transfers.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import * as inventoryApi from '@/api/inventory'
import { LIST_PAGE_SIZE } from '@/api/pageSize'
import type { MovementType } from '@/api/types'

export const STOCK_HISTORY_PAGE_SIZE = LIST_PAGE_SIZE

export interface StockHistoryQuery {
  warehouseId: number | null
  skuId: number | null
  movementType: MovementType | null
  /** `YYYY-MM-DD` lower bound, or null for the whole ledger. */
  since: string | null
}

export function useStockHistory(page: number, query: StockHistoryQuery) {
  const { warehouseId, skuId, movementType, since } = query

  return useQuery({
    queryKey: ['movements', 'history', page, warehouseId, skuId, movementType, since],
    queryFn: () =>
      inventoryApi.movements({
        page,
        page_size: STOCK_HISTORY_PAGE_SIZE,
        ...(warehouseId ? { warehouse: warehouseId } : {}),
        ...(skuId ? { sku: skuId } : {}),
        ...(movementType ? { movement_type: movementType } : {}),
        ...(since ? { date_from: since } : {}),
      }),
    placeholderData: keepPreviousData,
  })
}
