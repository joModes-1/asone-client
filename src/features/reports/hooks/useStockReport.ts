/**
 * The stock report's data.
 *
 * Three requests: stock levels, reorder alerts and the SKU catalogue. The
 * first two accept both `as_of` and `warehouse`, so the report answers for
 * any date at any site.
 *
 * The warehouse comes from the shell's filter rather than a local one, so the
 * top bar and the report's own control cannot disagree.
 *
 * ---------------------------------------------------------------------------
 * Why not /dashboard/summary/
 * ---------------------------------------------------------------------------
 * It would answer three of the four tiles in one call, and the dashboard uses
 * it for exactly that. But it takes only `warehouse` — there is no `as_of` —
 * so it always reports now. On a screen with a date filter that produced a
 * page contradicting itself: "16,482 units available" above a table showing
 * stock as at a date when there was none.
 *
 * So the report derives its own figures from dated sources and is internally
 * consistent at any date. The cost is summing units and value on the client,
 * which is worth it here because no endpoint totals stock as at a past date.
 *
 * The SKU catalogue is not optional. `/inventory/stock-levels/` returns a row
 * only where the ledger has movements, and `?include_zero=true` does not
 * change that — verified: 33 active SKUs, 2 with stock, and the flag returns
 * the same 2. The catalogue is what tells this screen a SKU exists at all,
 * and without it the report cannot show what is out of stock.
 */

import { useQueries } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { fetchAll } from '@/api/pageSize'
import * as inventoryApi from '@/api/inventory'
import { sumMoney } from '@/domain/money'
import { canReadMinimumStockLevels } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import type { Money } from '@/api/types'
import {
  countOutOfStock,
  toCategoryRows,
  toLedgerRows,
  warehouseColumns,
  type CategoryRow,
  type LedgerRow,
  type WarehouseColumn,
} from '../pivot'

export interface StockReportFilters {
  /** Stock as at this date. Omit for today. */
  asOf?: string
}

export interface StockReport {
  availableUnits: number | null
  inventoryValue: Money | null
  /**
   * Configured minimum-stock rows at or under their floor — one per SKU per
   * warehouse, so a SKU low at two sites counts twice. A SKU with no floor
   * configured is never counted, however low it runs.
   */
  lowStockAlerts: number | null
  outOfStockCount: number | null
  columns: WarehouseColumn[]
  rows: LedgerRow[]
  categories: CategoryRow[]
  loading: { figures: boolean; stock: boolean }
  error: boolean
}

export function useStockReport({ asOf }: StockReportFilters = {}): StockReport {
  const { user } = useAuth()
  const { warehouseId } = useWarehouseFilter()

  const [stock, alerts, skus] = useQueries({
    queries: [
      {
        queryKey: ['stock-levels', 'report', asOf, warehouseId],
        // include_zero covers SKUs the ledger has moved to zero; it does not
        // surface SKUs that never moved — hence the catalogue join below.
        queryFn: () =>
          inventoryApi.stockLevels({
            include_zero: true,
            as_of: asOf,
            warehouse: warehouseId,
          }),
      },
      {
        queryKey: ['reorder-alerts', 'report', asOf, warehouseId],
        queryFn: () => inventoryApi.reorderAlerts({ as_of: asOf, warehouse: warehouseId }),
        /* Warehouse staff, Finance and the leads. A school holds no stock, so
           it has no reorder floor to breach — and was fetching a 403 here on
           every visit. */
        enabled: canReadMinimumStockLevels(user),
      },
      {
        queryKey: ['skus', 'all'],
        /* Every SKU, paged to the end. This sent no `page_size` at all, so
           it took the server's default of 50 against a catalogue of 338 —
           and this report names a row per SKU, so it was reporting on a
           seventh of the catalogue and calling it the stock position. */
        queryFn: () => fetchAll((page) => catalogApi.skus(page)),
        staleTime: 10 * 60 * 1000,
      },
    ],
  })

  const stockRows = stock.data ?? []
  const skuList = skus.data ?? []
  const ready = Boolean(stock.data && skus.data)
  const rows = ready ? toLedgerRows(stockRows, skuList) : []

  return {
    availableUnits: stock.data
      ? stockRows.reduce((total, row) => total + Math.max(row.level, 0), 0)
      : null,
    // Exact, in integer minor units — never a float.
    inventoryValue: stock.data ? sumMoney(stockRows.map((row) => row.value)) : null,
    lowStockAlerts: alerts.data?.length ?? null,
    outOfStockCount: ready ? countOutOfStock(rows) : null,
    columns: warehouseColumns(stockRows),
    rows,
    categories: toCategoryRows(stockRows, skuList),
    loading: {
      figures: stock.isLoading || alerts.isLoading,
      stock: stock.isLoading || skus.isLoading,
    },
    error: stock.isError || alerts.isError,
  }
}
