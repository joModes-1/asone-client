/**
 * The price list and its gap report — F15, F51.
 *
 * Two queries rather than one, because they answer two questions and one of
 * them is the check on the other: the list is what would be published, the
 * gaps are what would silently be missing from it. Fetching them together
 * would still be two requests; keeping them apart means a failed gap report
 * does not take the list down with it, and the screen can say which half it
 * is missing.
 *
 * Both are cheap and rarely change — prices are dated master data, not a
 * live figure — so they hold for a few minutes rather than refetching on
 * every visit.
 */

import { useQuery } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import type { GarmentSchoolLevel } from '@/api/types'

const FRESH_MS = 5 * 60 * 1000

/** The level a price list is drawn for. `BOTH` is not one — it is a garment
    marking that puts a garment on each list, never a list of its own. */
export type PriceListLevel = Extract<GarmentSchoolLevel, 'PS' | 'HS'>

export function usePriceList(level: PriceListLevel, onDate: string) {
  return useQuery({
    queryKey: ['catalog', 'price-list', level, onDate],
    queryFn: () => catalogApi.priceList({ level, on: onDate }),
    staleTime: FRESH_MS,
  })
}

/**
 * The kit half of the same list — F15, F51.
 *
 * Its own query rather than part of the garment one: they are separate
 * documents a school reads for different reasons, and a failure on either
 * should not take the other down with it.
 */
export function useKitPriceList(level: PriceListLevel, onDate: string) {
  return useQuery({
    queryKey: ['catalog', 'kit-price-list', level, onDate],
    queryFn: () => catalogApi.kitPriceList({ level, on: onDate }),
    staleTime: FRESH_MS,
  })
}

export function useKitPriceGaps(level: PriceListLevel, onDate: string) {
  return useQuery({
    queryKey: ['catalog', 'kit-price-gaps', level, onDate],
    queryFn: () => catalogApi.kitPriceGaps({ level, on: onDate }),
    staleTime: FRESH_MS,
  })
}

export function usePriceGaps(level: PriceListLevel, onDate: string) {
  return useQuery({
    queryKey: ['catalog', 'price-gaps', level, onDate],
    queryFn: () => catalogApi.priceGaps({ level, on: onDate }),
    staleTime: FRESH_MS,
  })
}
