/**
 * Every active garment, for the Create SKU form's "Garment Type" picker.
 *
 * Inactive garments are excluded — a SKU cannot be built on a garment that
 * has been retired from the price list.
 */

import { useQuery } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { keys } from '@/api/keys'
import { fetchAll } from '@/api/pageSize'
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
    /*
     * Every page, and an array — the same shape `useInventoryRows` reads.
     *
     * These two share the `['garments']` key and used to return different
     * things: a `Page` here, a plain array there. React Query caches by key,
     * so whichever resolved first decided what the other one saw, and the
     * Inventory screen crashed with "garments.map is not a function" for the
     * only two roles that run both — Program Lead and Operations Manager. A
     * white screen for the leads and nobody else.
     *
     * One key, one shape. `fetchAll` also lifts the 200-row ceiling, which
     * matters here for the same reason it did there: 53 garments today, more
     * with every class band AsOne add.
     */
    queryFn: () => fetchAll((page) => catalogApi.garments(page)),
    enabled: mayRead,
    staleTime: 10 * 60 * 1000,
  })

  /*
   * The SKU picker wants only what can still be built on; the garments table
   * wants everything, because a retired garment is exactly the row somebody
   * goes there to un-retire.
   */
  const all = data ?? []
  return {
    garments: options?.includeInactive ? all : all.filter((g) => g.is_active !== false),
    isLoading,
  }
}
