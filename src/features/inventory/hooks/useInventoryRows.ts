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
import {
  canEditOrgSettings,
  canReadMinimumStockLevels,
  canReadStockHistory,
  canReadWarehouses,
} from '@/domain/access'
import { sumMoney } from '@/domain/money'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { useWarehouseOptions } from '@/features/catalog/hooks/useWarehouseOptions'
import type { Garment, GarmentSchoolLevel, Money, Sku } from '@/api/types'

const MAX_SHIPPED_PAGES = 20

/*
 * The stand-in site for a role that may read stock but not the warehouse
 * list — a school clerk. Id `0` because no real warehouse has one, so it can
 * never collide with a key built from a real `warehouse_id`, and because the
 * SKU detail panel and the minimum editor both key off a real id and are
 * closed to this role anyway.
 */
const ALL_SITES_ID = 0
const ALL_SITES = [{ id: ALL_SITES_ID, name: 'All AsOne warehouses' }]

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
  /**
   * On hand and pickable — or `null` where this SKU has never moved at this
   * warehouse.
   *
   * Null rather than 0, for the same reason as `value` below. A row is built
   * for every SKU at every warehouse, so most pairs have no ledger entry at
   * all, and 0 claimed we had looked and found none. A SKU that has never
   * arrived and one that sold out read identically.
   *
   * Anything doing arithmetic on this says `?? 0` at the point of use, so
   * the decision to treat "never stocked" as zero is made where it applies
   * rather than hidden here.
   */
  available: number | null
  /** Reserved for picking, or null — see `available`. */
  pick: number | null
  shipped: number
  /** Null when no floor is configured for this SKU at this warehouse. */
  minimumQuantity: number | null
  /**
   * The `MinimumStockLevel` row's own id, or null when there is no row.
   *
   * Carried because editing a minimum is a PATCH when one exists and a POST
   * when one does not, and the table is the only place that already knows
   * which. Without it the edit form would have to fetch the whole table again
   * to find out whether it is creating or changing.
   */
  minimumId: number | null

  /**
   * The stock on hand, valued — or `null` where this SKU has never moved at
   * this warehouse.
   *
   * Null rather than "0.00", which is what this used to be. A row is built
   * for every SKU at every warehouse, so most pairs have no ledger entry at
   * all, and a fabricated zero said "we valued this and it came to nothing"
   * about stock that has never arrived. A newly created SKU and one that
   * sold out looked identical.
   *
   * `formatCompactUGX` already renders null as an em dash, the same way
   * `minimumQuantity` above has always been shown.
   */
  value: Money | null
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
  const { user } = useAuth()
  const { warehouseId } = useWarehouseFilter()
  const { warehouses: allWarehouses } = useWarehouseOptions()
  const { level, sizeId, isActive, lowStockOnly, query } = filters

  /*
   * Two of these tables are narrower than this screen.
   *
   * Inventory is open to every role — SKUs and stock levels are readable by
   * all of them — but **garments are leads-only** and minimums are warehouse
   * staff and Finance, both deliberately, per AsOne's matrix (see
   * `catalog/tests/test_api.py::READ_AUDIENCE`, which states the garment case
   * is odd on its face and kept because the matrix says so).
   *
   * Asked anyway, they came back 403 on every load for the roles without
   * them — five failed requests per visit for a school clerk. The rows below
   * already read every garment field through `garment?.` and fall back, so
   * nothing is lost by not asking: the screen degrades to the SKU's own
   * description, which is what those roles were seeing regardless.
   */
  const mayReadGarments = canEditOrgSettings(user)
  const mayReadMinimums = canReadMinimumStockLevels(user)

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
        enabled: mayReadGarments,
      },
      {
        queryKey: keys.stockLevels(warehouseId),
        queryFn: () => inventoryApi.stockLevels({ warehouse: warehouseId, include_zero: true }),
      },
      {
        queryKey: keys.minimumStockLevels(warehouseId),
        queryFn: () =>
          catalogApi.minimumStockLevels({ warehouse: warehouseId ?? undefined, page_size: 200 }),
        enabled: mayReadMinimums,
      },
      {
        queryKey: keys.shippedTotals(warehouseId),
        queryFn: () => fetchShippedTotals(warehouseId),
        /* The ledger is the audit trail, and a school is refused it — see
           `canReadStockHistory`. Their Shipped column reads 0, which is what
           it read before, without the 403 on the way. */
        enabled: canReadStockHistory(user),
      },
    ],
  })

  const skus = skusQuery.data?.results ?? []
  const garments = garmentsQuery.data?.results ?? []
  const stockLevels = stockQuery.data ?? []
  const minimums = minimumsQuery.data?.results ?? []
  const shippedByKey = shippedQuery.data ?? new Map<string, number>()

  /*
   * The warehouses these rows should cover: the one the shell has picked, or
   * every warehouse the signed-in role may see if it hasn't picked one.
   *
   * For a school clerk that list is **empty**, and not by accident — AsOne's
   * matrix refuses them `catalog:warehouse-list` (see `canReadWarehouses`),
   * so `useWarehouseOptions` never asks. The row loop below is `SKU ×
   * warehouse`, so an empty list silently produced an empty table: a school
   * saw "No SKUs match this filter" over 35 readable SKUs and 30 readable
   * stock rows, with no error to explain it.
   *
   * `ALL_SITES` is the answer rather than widening the permission, because
   * the permission is right. A school does not order from a warehouse — it
   * orders from AsOne, and which site fills the order is AsOne's allocation
   * decision. What a school needs from this screen is "does this exist and
   * can I get it", which is one row per SKU with the stock summed across
   * every site. Naming the sites would be both a permission they lack and an
   * answer to a question they are not asking.
   */
  const perSite = canReadWarehouses(user)
  const warehouses = !perSite
    ? ALL_SITES
    : warehouseId !== null
      ? allWarehouses.filter((w) => w.id === warehouseId)
      : allWarehouses

  const garmentById = new Map<number, Garment>(garments.map((g) => [g.id, g]))
  /*
   * Keyed by SKU *and* site normally; by SKU alone, with the sites added
   * together, for a role that cannot tell one site from another. `sumMoney`
   * rather than `+` because value is a decimal string — see `money.ts`.
   */
  const stockByKey = new Map<string, { level: number; reserved: number; value: Money }>()
  for (const entry of stockLevels) {
    const key = perSite ? `${entry.sku_id}-${entry.warehouse_id}` : `${entry.sku_id}-${ALL_SITES_ID}`
    const running = stockByKey.get(key)
    stockByKey.set(
      key,
      running
        ? {
            level: running.level + entry.level,
            reserved: running.reserved + entry.reserved,
            value: sumMoney([running.value, entry.value]),
          }
        : { level: entry.level, reserved: entry.reserved, value: entry.value },
    )
  }
  const minimumByKey = new Map(
    minimums.map((m) => [`${m.sku}-${m.warehouse}`, m]),
  )

  const needle = query.trim().toLowerCase()
  const rows: InventoryRow[] = []

  for (const sku of skus as Sku[]) {
    const garment = garmentById.get(sku.garment)
    for (const warehouse of warehouses) {
      const key = `${sku.id}-${warehouse.id}`
      const stock = stockByKey.get(key)
      const minimum = minimumByKey.get(key) ?? null

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
        available: stock?.level ?? null,
        pick: stock?.reserved ?? null,
        shipped: shippedByKey.get(key) ?? 0,
        minimumQuantity: minimum?.minimum_quantity ?? null,
        minimumId: minimum?.id ?? null,
        value: stock?.value ?? null,
        isActive: sku.is_active ?? true,
      }

      // `available` is null where this SKU has never moved at this
      // warehouse, and nothing on hand is below any floor — so it counts as
      // zero here rather than being skipped.
      if (
        lowStockOnly &&
        (row.minimumQuantity === null || (row.available ?? 0) > row.minimumQuantity)
      ) {
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
