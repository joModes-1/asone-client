/**
 * Inventory Overview's rows — one per SKU per warehouse.
 *
 * Four reads, joined on the client: the SKU catalogue (garment, size,
 * active flag), the garments themselves (colour, school level — a SKU
 * carries only `garment_name`, not the garment's own fields), stock levels
 * (available, reserved, value — summed from the ledger on read, see
 * `StockLevel`), and the configured minimum per SKU per warehouse.
 *
 * Seeded from the SKU catalogue rather than from stock levels alone, the
 * same reasoning as the stock report's `toLedgerRows`: `/inventory/stock-levels/`
 * returns a row only where the ledger has movements, so a SKU never stocked
 * would otherwise be missing rather than shown at zero.
 *
 * `shipped` has no server aggregation to read (unlike `level` and
 * `reserved`, which `/inventory/stock-levels/` already sums) — computed here
 * instead, from the same ledger the app already exposes: every SHIPMENT
 * posts a positive SHIPPED-status row (orders/services/shipping.py,
 * backorders.py), so summing those per SKU per warehouse is the same
 * arithmetic the server would do, just run client-side.
 *
 * `fetchShippedTotals` pages through the whole SHIPMENT ledger for the
 * warehouse(s) in scope — capped at `MAX_PAGES` (4,000 rows) as a sane
 * limit for this system's current size. If AsOne's shipment history ever
 * grows past that, this sum belongs server-side next to `level`/`reserved`
 * in `inventory/services.py: stock_levels` instead of paging the ledger from
 * the browser.
 */

import { useQueries } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import * as inventoryApi from '@/api/inventory'
import { keys } from '@/api/keys'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { useWarehouseOptions } from '@/features/catalog/hooks/useWarehouseOptions'
import type { Garment, GarmentSchoolLevel, Money, Sku } from '@/api/types'

const MAX_SHIPPED_PAGES = 20

/** Every SHIPMENT ledger row for the warehouse(s) in scope, summed per SKU per warehouse. */
async function fetchShippedTotals(warehouseId: number | null): Promise<Map<string, number>> {
  const totals = new Map<string, number>()
  let page = 1

  while (page <= MAX_SHIPPED_PAGES) {
    const response = await inventoryApi.movements({
      movement_type: 'SHIPMENT',
      warehouse: warehouseId ?? undefined,
      page,
      page_size: 200,
    })

    for (const movement of response.results) {
      // A shipment posts two rows — the PICK removal and the SHIPPED
      // addition (see shipping.py). Only the SHIPPED one counts as shipped.
      if (movement.stock_status !== 'SHIPPED') continue
      const key = `${movement.sku}-${movement.warehouse}`
      totals.set(key, (totals.get(key) ?? 0) + movement.quantity)
    }

    if (!response.next) break
    page += 1
  }

  return totals
}

export interface InventoryFilters {
  level: GarmentSchoolLevel | null
  sizeId: number | null
  isActive: boolean | null
  lowStockOnly: boolean
  query: string
}

export interface InventoryRow {
  skuId: number
  skuNumber: string
  garmentName: string
  description: string
  level: GarmentSchoolLevel
  sizeName: string
  colour: string
  warehouseId: number
  warehouseName: string
  available: number
  pick: number
  shipped: number
  /** Null when no floor is configured for this SKU at this warehouse. */
  minimumQuantity: number | null
  value: Money
  isActive: boolean
}

export interface InventoryResult {
  rows: InventoryRow[]
  /** Every warehouse a row in this result can belong to — for the CSV export and empty states. */
  warehouseCount: number
  isLoading: boolean
  isError: boolean
}

function matchesQuery(row: InventoryRow, needle: string): boolean {
  if (!needle) return true
  return (
    row.skuNumber.toLowerCase().includes(needle) ||
    row.garmentName.toLowerCase().includes(needle) ||
    row.description.toLowerCase().includes(needle)
  )
}

export function useInventoryRows(filters: InventoryFilters): InventoryResult {
  const { warehouseId } = useWarehouseFilter()
  const { warehouses: allWarehouses } = useWarehouseOptions()
  const { level, sizeId, isActive, lowStockOnly, query } = filters

  const [skusQuery, garmentsQuery, stockQuery, minimumsQuery, shippedQuery] = useQueries({
    queries: [
      {
        queryKey: keys.inventorySkus(level, sizeId, isActive),
        queryFn: () =>
          catalogApi.skus({
            garment__school_level: level ?? undefined,
            size: sizeId ?? undefined,
            is_active: isActive ?? undefined,
            page_size: 200,
          }),
      },
      {
        queryKey: keys.garments(),
        queryFn: () => catalogApi.garments({ page_size: 200 }),
        staleTime: 10 * 60 * 1000,
      },
      {
        queryKey: keys.stockLevels(warehouseId),
        queryFn: () => inventoryApi.stockLevels({ warehouse: warehouseId, include_zero: true }),
      },
      {
        queryKey: keys.minimumStockLevels(warehouseId),
        queryFn: () =>
          catalogApi.minimumStockLevels({ warehouse: warehouseId ?? undefined, page_size: 200 }),
      },
      {
        queryKey: keys.shippedTotals(warehouseId),
        queryFn: () => fetchShippedTotals(warehouseId),
      },
    ],
  })

  const skus = skusQuery.data?.results ?? []
  const garments = garmentsQuery.data?.results ?? []
  const stockLevels = stockQuery.data ?? []
  const minimums = minimumsQuery.data?.results ?? []
  const shippedByKey = shippedQuery.data ?? new Map<string, number>()

  // The warehouses these rows should cover: the one the shell has picked, or
  // every warehouse the signed-in role may see if it hasn't picked one.
  const warehouses =
    warehouseId !== null
      ? allWarehouses.filter((w) => w.id === warehouseId)
      : allWarehouses

  const garmentById = new Map<number, Garment>(garments.map((g) => [g.id, g]))
  const stockByKey = new Map(
    stockLevels.map((s) => [`${s.sku_id}-${s.warehouse_id}`, s]),
  )
  const minimumByKey = new Map(
    minimums.map((m) => [`${m.sku}-${m.warehouse}`, m.minimum_quantity]),
  )

  const needle = query.trim().toLowerCase()
  const rows: InventoryRow[] = []

  for (const sku of skus as Sku[]) {
    const garment = garmentById.get(sku.garment)
    for (const warehouse of warehouses) {
      const key = `${sku.id}-${warehouse.id}`
      const stock = stockByKey.get(key)
      const minimumQuantity = minimumByKey.get(key) ?? null

      const row: InventoryRow = {
        skuId: sku.id,
        skuNumber: sku.number,
        garmentName: sku.garment_name,
        description: sku.description || sku.garment_name,
        level: garment?.school_level ?? 'BOTH',
        sizeName: sku.size_name,
        colour: garment?.colour ?? '',
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        available: stock?.level ?? 0,
        pick: stock?.reserved ?? 0,
        shipped: shippedByKey.get(key) ?? 0,
        minimumQuantity,
        value: stock?.value ?? '0.00',
        isActive: sku.is_active ?? true,
      }

      if (lowStockOnly && (row.minimumQuantity === null || row.available > row.minimumQuantity)) {
        continue
      }
      if (!matchesQuery(row, needle)) continue

      rows.push(row)
    }
  }

  return {
    rows,
    warehouseCount: warehouses.length,
    isLoading:
      skusQuery.isLoading || garmentsQuery.isLoading || stockQuery.isLoading || shippedQuery.isLoading,
    isError: skusQuery.isError || garmentsQuery.isError || stockQuery.isError || shippedQuery.isError,
  }
}
