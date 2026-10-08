/**
 * Every active SKU, for a picker.
 *
 * Fetched whole rather than searched: AsOne's catalogue is hundreds of SKUs,
 * not thousands, and a picker that has them all can be typed into without a
 * round trip per keystroke.
 *
 * The sibling of `useWarehouseOptions`, and the single owner of this query
 * key: production orders, adjustments and transfers all reach for the same
 * list, and three copies of it is three caches that disagree.
 *
 * ---------------------------------------------------------------------------
 * Paged to the end, and why that is not optional
 * ---------------------------------------------------------------------------
 * This asked for `page_size: 200` and used what came back. The comment here
 * said "the day that stops being enough, this is the one place to page it" —
 * and that day arrived without anybody noticing, which is the trouble with
 * a silent cap. AsOne's catalogue is 338 active SKUs, so **138 of them were
 * absent from every picker in the app**, with nothing saying so.
 *
 * It was invisible because the cut falls alphabetically: building a Nursery
 * kit offered eight garments and the rest of the alphabet — Red T-Shirt,
 * Sweater, Socks, White Shirt — simply were not there, which reads as "that
 * garment is missing from the catalogue" rather than as a bug.
 *
 * `fetchAll` keeps asking until the server runs out. See `src/api/pageSize.ts`,
 * where the same thing had already happened twice: once to the inventory
 * table, once to the kit list.
 */

import { useQuery } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { fetchAll } from '@/api/pageSize'

export function useSkuOptions(enabled = true) {
  return useQuery({
    queryKey: ['skus', 'orderable'],
    queryFn: () => fetchAll((page) => catalogApi.skus({ is_active: true, ...page })),
    staleTime: 10 * 60 * 1000,
    enabled,
  })
}
