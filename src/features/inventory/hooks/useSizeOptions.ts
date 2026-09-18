/**
 * Every size, for the Inventory filter bar and the Create SKU form.
 *
 * Same reasoning as `useWarehouseOptions` — a short, rarely-changing list,
 * so one unpaginated fetch is fine.
 */

import { useQuery } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { keys } from '@/api/keys'

export function useSizeOptions() {
  const { data, isLoading } = useQuery({
    queryKey: keys.sizes(),
    queryFn: () => catalogApi.sizes({ page_size: 200 }),
    staleTime: 10 * 60 * 1000,
  })

  return { sizes: data?.results ?? [], isLoading }
}
