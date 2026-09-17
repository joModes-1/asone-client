/**
 * Placing a school order, and the catalogue a school may place it from.
 *
 * ---------------------------------------------------------------------------
 * A school orders from its own level
 * ---------------------------------------------------------------------------
 * The same rule as the price list (F29): a Primary school cannot order a
 * High School blazer, because that blazer never appears on its price list.
 * The server refuses it either way — `_refuse_wrong_level` in
 * `orders/services/pos.py` — but a picker that offers something the server
 * will reject is the screen's mistake rather than the clerk's, so the
 * filtering happens here too.
 *
 * `BOTH` is on every list. A jumper marked for both levels is orderable by
 * either school, which is why the SKU filter asks the garment rather than
 * comparing strings.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import * as kitsApi from '@/api/kits'
import * as ordersApi from '@/api/orders'
import { snackbar } from '@/components'
import type { SchoolLevel } from '@/api/types'

/** Kits this school may order: its own level only — a kit is never BOTH. */
export function useOrderableKits(level: SchoolLevel | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['kits', 'orderable', level],
    queryFn: () => kitsApi.kits({ page_size: 200 }),
    enabled: Boolean(level),
    staleTime: 5 * 60 * 1000,
  })

  const kits = (data?.results ?? []).filter(
    (kit) => kit.is_active && kit.school_level === level,
  )

  return { kits, isLoading }
}

/** Items this school may order: its own level, plus anything marked BOTH. */
export function useOrderableSkus(level: SchoolLevel | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['skus', 'orderable', level],
    queryFn: () => catalogApi.skus({ page_size: 200, is_active: true }),
    enabled: Boolean(level),
    staleTime: 5 * 60 * 1000,
  })

  const skus = (data?.results ?? []).filter((sku) => {
    const garmentLevel = sku.garment_school_level
    return garmentLevel === level || garmentLevel === 'BOTH'
  })

  return { skus, isLoading }
}

/**
 * Place the order.
 *
 * Invalidates every list that counts orders rather than patching one row in:
 * a new order shows on the school's own list, on the leads' on-hold report
 * and on the dashboard, and those are three different queries.
 */
export function usePlaceOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ordersApi.PlaceOrderInput) => ordersApi.placeOrder(input),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      snackbar.success(
        `${order.number} placed for ${order.student_name}`,
        'It is on hold until Finance confirms payment. Nothing is reserved in the warehouse yet.',
      )
    },
    // Failure is reported by the shared mutation handler.
  })
}
