/**
 * Setting a SKU's minimum stock level at one warehouse.
 *
 * ---------------------------------------------------------------------------
 * Why a create *and* an update behind one call
 * ---------------------------------------------------------------------------
 * `MinimumStockLevel` is its own row — one per SKU per warehouse — and it is
 * optional: a SKU with no row has no floor, which is why a warehouse can show
 * a quantity that never turns amber.
 *
 * So "set the minimum to 50" is a POST the first time and a PATCH every time
 * after, and which one it is depends on a fact the caller already has. The
 * screen should not have to know that, so it passes the row's `minimumId` and
 * this decides.
 *
 * ---------------------------------------------------------------------------
 * Why clearing it is a separate thought
 * ---------------------------------------------------------------------------
 * There is no DELETE offered here. Removing a floor means a SKU stops being
 * reported as low without anybody deciding it is well stocked — the alert
 * simply goes quiet. If AsOne wants that, it should be its own deliberate
 * action with its own wording, not the empty case of an edit field.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'

export interface SaveMinimumInput {
  /** The existing row's id, or null to create one. */
  minimumId: number | null
  skuId: number
  warehouseId: number
  minimumQuantity: number
}

export function useSaveMinimum() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ minimumId, skuId, warehouseId, minimumQuantity }: SaveMinimumInput) =>
      minimumId === null
        ? catalogApi.createMinimumStockLevel({
            sku: skuId,
            warehouse: warehouseId,
            minimum_quantity: minimumQuantity,
          })
        : catalogApi.updateMinimumStockLevel(minimumId, {
            minimum_quantity: minimumQuantity,
          }),
    onSuccess: () => {
      /*
       * The reorder alerts and the dashboard's Needs Attention both key off
       * this figure, so a minimum raised above what is on the shelf must
       * light the alert up in the same breath. Leaving them stale is how a
       * warehouse goes on reading "all clear" for the rest of the session
       * after the floor moved under it.
       */
      void queryClient.invalidateQueries({ queryKey: ['minimum-stock-levels'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['reorder-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
