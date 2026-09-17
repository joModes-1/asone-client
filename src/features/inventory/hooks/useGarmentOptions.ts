/**
 * Every active garment, for the Create SKU form's "Garment Type" picker.
 *
 * Inactive garments are excluded — a SKU cannot be built on a garment that
 * has been retired from the price list.
 */

import { useQuery } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { keys } from '@/api/keys'
import { can } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'

export function useGarmentOptions(options?: { includeInactive?: boolean }) {
  const { user } = useAuth()

  /*
   * Not fetched for a role that may not read garments.
   *
   * F05 leaves the garment table to the two leads, so Finance opening the
   * inventory screen was firing a request that could only 403 — a red line
   * in the console on a screen that was working perfectly. The picker this
   * feeds is leads-only anyway.
   */
  const mayRead = can(user, 'table_updates')

  const { data, isLoading } = useQuery({
    queryKey: keys.garments(),
    queryFn: () => catalogApi.garments({ page_size: 200 }),
    enabled: mayRead,
    staleTime: 10 * 60 * 1000,
  })

  /*
   * The SKU picker wants only what can still be built on; the garments table
   * wants everything, because a retired garment is exactly the row somebody
   * goes there to un-retire.
   */
  const all = data?.results ?? []
  return {
    garments: options?.includeInactive ? all : all.filter((g) => g.is_active !== false),
    isLoading,
  }
}
