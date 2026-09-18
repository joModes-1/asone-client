/**
 * A Tailoring Center's own production orders, newest first — the queue shown
 * on its card.
 *
 * `fulfilment_status` is computed on the server, not a real column, so
 * `ProductionOrderViewSet.filterset_fields` has nothing to filter it by —
 * only `status` (Open/Closed/Cancelled) is filterable. So the card's stats
 * are counted here, over this fetch: one bounded page (a TC's lifetime
 * order count is tens, not thousands) rather than one request per bucket.
 */

import { useQuery } from '@tanstack/react-query'
import * as procurement from '@/api/procurement'

/*
  Deliberately not `LIST_PAGE_SIZE`. This is not a paginated list — there are
  no controls under the card — it is one bounded fetch that the chips above
  it are counted over. At the list size the chips would describe the first
  ten of a centre's orders and read as though that were all of them.
*/
const PAGE_SIZE = 50

export function useTailoringCenterProductionOrders(tailoringCenterId: number) {
  const { data, isLoading } = useQuery({
    queryKey: ['production-orders', 'by-tailoring-center', tailoringCenterId],
    queryFn: () =>
      procurement.productionOrders({
        tailoring_center: tailoringCenterId,
        page_size: PAGE_SIZE,
      }),
  })

  return {
    orders: data?.results ?? [],
    totalCount: data?.count ?? 0,
    isLoading,
  }
}
