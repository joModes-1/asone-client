/**
 * Create a SKU, then its per-warehouse minimum stock thresholds.
 *
 * Two write calls in sequence rather than one: a SKU has no minimum levels
 * of its own to send at creation (`MinimumStockLevel` is its own row, one per
 * warehouse — see the model), so a threshold cannot exist before the SKU
 * does. A threshold left blank in the form is simply not sent — "no floor
 * configured" is a real, valid state (see `useInventoryRows`), not zero.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { snackbar } from '@/components'

export interface CreateSkuInput {
  garment: number
  size: number
  /** Left undefined to let the server fill it in from the garment and size. */
  description?: string
  isActive: boolean
  /** One entry per warehouse the form had a value for — never all of them. */
  minimums: { warehouseId: number; quantity: number }[]
}

export function useCreateSku() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateSkuInput) => {
      const sku = await catalogApi.createSku({
        garment: input.garment,
        size: input.size,
        description: input.description,
        is_active: input.isActive,
      })

      await Promise.all(
        input.minimums.map((m) =>
          catalogApi.createMinimumStockLevel({
            sku: sku.id,
            warehouse: m.warehouseId,
            minimum_quantity: m.quantity,
          }),
        ),
      )

      return sku
    },
    meta: { silent: true },
    onSuccess: (sku) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      void queryClient.invalidateQueries({ queryKey: ['minimum-stock-levels'] })
      snackbar.success(`${sku.number} — ${sku.description} added`)
    },
  })
}
