/**
 * The two procurement finance reports — F55 and F56.
 *
 * Both take a period and both are read by Finance and the leads. They are
 * separate queries rather than one, because they answer different halves of
 * the same question and each is useful without the other: what was
 * **committed** to the Tailoring Centres, and what actually **arrived**.
 *
 * The gap between the two figures is the point of reading them together —
 * money promised against goods received — which is why the screen shows both
 * and says so.
 */

import { useQuery } from '@tanstack/react-query'
import * as procurement from '@/api/procurement'

/** Periods change rarely and neither report is cheap to recompute. */
const FRESH_MS = 5 * 60 * 1000

export interface CostedPeriod {
  /** `YYYY-MM-DD`, or empty for no bound. */
  from: string
  to: string
}

export function useGroupOrdersCosted(period: CostedPeriod, includeCancelled: boolean) {
  return useQuery({
    queryKey: ['procurement', 'group-orders-costed', period.from, period.to, includeCancelled],
    queryFn: () =>
      procurement.groupOrdersCosted({
        ...(period.from ? { from: period.from } : {}),
        ...(period.to ? { to: period.to } : {}),
        // Only sent when true: the server's own default is to exclude them,
        // and sending `false` would be asking for the default in longhand.
        ...(includeCancelled ? { include_cancelled: true } : {}),
      }),
    staleTime: FRESH_MS,
  })
}

export function useReceiptsCosted(period: CostedPeriod) {
  return useQuery({
    queryKey: ['procurement', 'receipts-costed', period.from, period.to],
    queryFn: () =>
      procurement.receiptsCosted({
        ...(period.from ? { from: period.from } : {}),
        ...(period.to ? { to: period.to } : {}),
      }),
    staleTime: FRESH_MS,
  })
}
