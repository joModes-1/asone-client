/**
 * Every active garment, for the Create SKU form's "Garment Type" picker.
 *
 * Inactive garments are excluded — a SKU cannot be built on a garment that
 * has been retired from the price list.
 */

import { useQuery } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { keys } from '@/api/keys'

export function useGarmentOptions() {
  const { data, isLoading } = useQuery({
    queryKey: keys.garments(),
    queryFn: () => catalogApi.garments({ page_size: 200 }),
    staleTime: 10 * 60 * 1000,
  })

  return { garments: (data?.results ?? []).filter((g) => g.is_active !== false), isLoading }
}
