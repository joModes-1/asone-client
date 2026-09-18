/**
 * Adding a garment, and adding a size.
 *
 * Both existed on the server with no way in from the app, which is the dead
 * end this closes: Create New SKU asks for a garment and a size, and if
 * either was missing the only route was the Django admin.
 *
 * Leads only, both of them — F05 gives garments and sizes to the two leads
 * and nobody else, which is narrower than SKUs. The server refuses the rest;
 * the menu hides what it refuses.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { snackbar } from '@/components'

export function useCreateGarment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: catalogApi.GarmentInput) => catalogApi.createGarment(input),
    onSuccess: (garment) => {
      // The SKU form reads this list, and the point of adding a garment is
      // usually to use it in the next breath.
      void queryClient.invalidateQueries({ queryKey: ['garments'] })
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      snackbar.success(
        `${garment.name} added`,
        `Its code is ${garment.code} — every SKU beneath it is numbered from that.`,
      )
    },
  })
}

/**
 * Set a garment's price from a date.
 *
 * Never an overwrite — see `catalog.reprice`. The snackbar says the date
 * rather than just "saved", because a price that applies from next term is a
 * different thing from one that applies now and the difference is invisible
 * once the dialogue closes.
 */
export function useUpdateGarment(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Partial<catalogApi.GarmentInput>) =>
      catalogApi.updateGarment(id, input),
    onSuccess: (garment) => {
      void queryClient.invalidateQueries({ queryKey: ['garments'] })
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      snackbar.success(`${garment.name} saved`)
    },
  })
}

export function useReprice(garmentId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: catalogApi.RepriceInput) => catalogApi.reprice(garmentId, input),
    onSuccess: (price) => {
      void queryClient.invalidateQueries({ queryKey: ['garments'] })
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      // Kits and orders are costed from this, so anything showing money is
      // now out of date.
      void queryClient.invalidateQueries({ queryKey: ['kits'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      snackbar.success(
        `Price set from ${price.active_date}`,
        'Invoices already raised keep the price that applied on their own date.',
      )
    },
  })
}

/** Every price a garment has had — what applied when. */
export function useGarmentPrices(garmentId: number | null) {
  return useQuery({
    queryKey: ['garments', 'prices', garmentId],
    queryFn: () => catalogApi.garmentPrices(garmentId as number),
    enabled: garmentId !== null,
  })
}

export function useCreateSize() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: catalogApi.SizeInput) => catalogApi.createSize(input),
    onSuccess: (size) => {
      void queryClient.invalidateQueries({ queryKey: ['sizes'] })
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      snackbar.success(`Size ${size.name} added`)
    },
  })
}
