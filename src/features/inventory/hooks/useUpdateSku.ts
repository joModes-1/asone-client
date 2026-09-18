/**
 * Editing one SKU.
 *
 * Invalidates the inventory rows rather than patching one in: the list is
 * built by joining SKUs to stock levels and minimum levels across
 * warehouses, so a changed description touches more rows than the one
 * edited.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { snackbar } from '@/components'

export function useUpdateSku(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: catalogApi.SkuPatch) => catalogApi.updateSku(id, input),
    onSuccess: (sku) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      snackbar.success(
        `${sku.number} saved`,
        sku.is_active ? undefined : 'It can no longer be added to a new order.',
      )
    },
  })
}
