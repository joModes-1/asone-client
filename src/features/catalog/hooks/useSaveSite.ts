/**
 * Creating a warehouse and creating a tailoring centre.
 *
 * Both endpoints have existed since the catalogue was built and nothing
 * called them: `createWarehouse` and `createTailoringCenter` were in
 * `api/catalog.ts` with no screen behind them, so setting up a new site
 * meant the Django admin.
 *
 * Leads only — master data is the Table Updates column. The server refuses
 * the rest; the screens hide the button.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { snackbar } from '@/components'

/** Everything that lists sites, because a new one belongs on all of them. */
function invalidateSites(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['catalog'] })
  void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
  void queryClient.invalidateQueries({ queryKey: ['tailoring-centers'] })
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: catalogApi.WarehouseInput) => catalogApi.createWarehouse(input),
    onSuccess: (warehouse) => {
      invalidateSites(queryClient)
      snackbar.success(
        `${warehouse.name} added`,
        'It holds no stock yet — a receipt against a production order is what puts some there.',
      )
    },
  })
}

export function useCreateTailoringCenter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: catalogApi.TailoringCenterInput) =>
      catalogApi.createTailoringCenter(input),
    onSuccess: (center) => {
      invalidateSites(queryClient)
      snackbar.success(
        `${center.name} added`,
        'Production orders can be placed against it now.',
      )
    },
  })
}
