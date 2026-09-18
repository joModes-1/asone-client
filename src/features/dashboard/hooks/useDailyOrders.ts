/**
 * Orders per day, per warehouse.
 *
 * `/dashboard/order-volume/` returns one warehouse's series with its total
 * and daily average already computed. It takes `?warehouse=`, so a chart
 * comparing sites is one request per site — which is two, today, and the
 * reason this does not need an endpoint of its own.
 *
 * ---------------------------------------------------------------------------
 * Who gets how many lines
 * ---------------------------------------------------------------------------
 * A warehouse clerk sees their own site and nothing else, so they get one
 * line whatever they ask for — the server pins them regardless. A lead or
 * Finance looking at "All warehouses" gets one line per site, because the
 * interesting question there is not the total but whether Namayemba and
 * Serere are moving together. Narrowing the top-bar filter to one site drops
 * back to the single line for it.
 *
 * This replaced a client-side roll-up over `/orders/school-orders/` that had
 * two problems the server's version does not: that endpoint answers **403
 * for both leads**, so the chart was unbuildable on the dashboard it was
 * drawn for, and it has no date-range filter, so a month meant paging
 * through the order list and capping the result.
 */

import { useQueries } from '@tanstack/react-query'
import * as dashboardApi from '@/api/dashboard'
import { keys } from '@/api/keys'
import { useWarehouseOptions } from '@/features/catalog/hooks/useWarehouseOptions'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import type { OrderVolumeDay } from '@/api/types'

export interface OrdersSeries {
  /** The warehouse this line is for, or "All warehouses" for a scoped role. */
  name: string
  days: OrderVolumeDay[]
}

export interface DailyOrders {
  /** One entry per line to draw. */
  series: OrdersSeries[]
  /** The x-axis, taken from the longest series so no line is clipped. */
  days: OrderVolumeDay[]
  total: number
  average: number
  isLoading: boolean
  isError: boolean
}

export function useDailyOrders(): DailyOrders {
  const { warehouseId, canSwitch, siteLabel } = useWarehouseFilter()
  const { warehouses } = useWarehouseOptions()

  /*
    One query per line. `useQueries` rather than a loop of `useQuery`,
    because the number of warehouses is data — hooks cannot be called
    conditionally, and this is the shape React Query provides for exactly
    that.
  */
  const compare = canSwitch && warehouseId === null && warehouses.length > 1
  const targets = compare
    ? warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name }))
    : [{ id: warehouseId, name: warehouseId === null ? siteLabel : siteLabel }]

  const results = useQueries({
    queries: targets.map((target) => ({
      queryKey: keys.orderVolume(target.id),
      queryFn: () => dashboardApi.orderVolume({ warehouse: target.id }),
    })),
  })

  const series = results.map((result, index) => ({
    name: targets[index].name,
    days: result.data?.days ?? [],
  }))

  /*
    The x-axis comes from whichever site reported the most days rather than
    from the first. They should agree — it is the same month — but a site
    with no orders at all can come back short, and a shorter axis would
    silently clip the other line.
  */
  const days = series.reduce<OrderVolumeDay[]>(
    (longest, entry) => (entry.days.length > longest.length ? entry.days : longest),
    [],
  )

  // Across every line drawn, so the figure under the chart matches it.
  const total = results.reduce((sum, result) => sum + (result.data?.total ?? 0), 0)
  const average = results.reduce(
    (sum, result) => sum + (result.data?.average_per_day ?? 0),
    0,
  )

  return {
    series,
    days,
    total,
    average: Math.round(average),
    isLoading: results.some((result) => result.isLoading),
    isError: results.some((result) => result.isError),
  }
}
