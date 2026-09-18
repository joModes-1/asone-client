/**
 * One school's orders, for the Locations detail screen — F30-F36 read-only.
 *
 * Real as of the backend widening `SchoolOrderViewSet.read_roles` to include
 * both leads (9 September 2026, pending AsOne's written confirmation — see
 * `orders/views.py`) and adding a `?school=` filter to go with it. Until
 * then this screen showed an honest "not available for this role" message
 * instead; now it can show the real list.
 *
 * Paged the same way `/orders` pages the full list (same `PAGE_SIZE`,
 * `keepPreviousData` so the table doesn't blank between pages) — a school
 * with more than a handful of orders was otherwise an ever-growing table
 * with no way to see just the last page.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import * as ordersApi from '@/api/orders'
import { keys } from '@/api/keys'

const PAGE_SIZE = 15

export function useSchoolOrdersForSchool(schoolId: number, page: number) {
  const { data, isLoading, isError } = useQuery({
    queryKey: keys.schoolOrdersForSchool(schoolId, page),
    queryFn: () => ordersApi.schoolOrders({ school: schoolId, page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  return {
    orders: data?.results ?? [],
    totalCount: data?.count ?? 0,
    pageSize: PAGE_SIZE,
    isLoading,
    isError,
  }
}
