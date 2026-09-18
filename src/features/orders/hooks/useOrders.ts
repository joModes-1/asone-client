/**
 * The order list, for the design's four tabs.
 *
 * Three of the tabs are one status and so one request. "In Progress" spans
 * two — RELEASED and PICKED — and the server's filter takes a single exact
 * value (`filterset_fields = ("status", "order_date")`), so that tab issues
 * one request per status and merges them.
 *
 * The merge pages on the client, which is only sound because it fetches
 * every page of both statuses first. That is fine at AsOne's volume and
 * would not be at ten times it. The fix is `?status__in=` on the server,
 * after which this collapses back to a single query like the others.
 *
 * Fifteen rows a page. The server used to fix every list at fifty;
 * `config/pagination.py` now accepts `?page_size=`, so the screen asks for
 * what it draws instead of fetching fifty and slicing — which would have left
 * the page numbers describing something other than what was on screen.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import * as ordersApi from '@/api/orders'
import type { SchoolOrder, SchoolOrderStatus } from '@/api/types'
import { LIST_PAGE_SIZE } from '@/api/pageSize'

/** Guard against pulling an unbounded list if the data ever grows. */
const MAX_PAGES = 10

export interface OrdersTab {
  label: string
  /** Empty means every status. */
  statuses: SchoolOrderStatus[]
}

export const ORDER_TABS: readonly OrdersTab[] = [
  { label: 'All Orders', statuses: [] },
  { label: 'Pending', statuses: ['HOLD'] },
  // Shipped sits in "In Progress" on purpose. A parcel on a lorry is not a
  // finished order — the school has not said it arrived. Completed means
  // exactly that and nothing looser, which is what makes the difference
  // between the two tabs worth counting.
  { label: 'In Progress', statuses: ['RELEASED', 'PICKED', 'SHIPPED'] },
  { label: 'Completed', statuses: ['COMPLETED'] },
]

async function fetchAll(status: SchoolOrderStatus): Promise<SchoolOrder[]> {
  const collected: SchoolOrder[] = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    // A larger page here: this is a background fetch to build one merged
    // list, not what the table renders.
    const response = await ordersApi.schoolOrders({ status, page, page_size: 100 })
    collected.push(...response.results)
    if (!response.next) break
  }

  return collected
}

export interface OrdersPage {
  orders: SchoolOrder[]
  total: number
  pageSize: number
  isLoading: boolean
  isFetching: boolean
}

/** Rows per page. One constant, used for the request and the page count, so
 *  the two cannot disagree. */
const PAGE_SIZE = LIST_PAGE_SIZE

export function useOrders(tab: OrdersTab, page: number): OrdersPage {
  const multi = tab.statuses.length > 1

  // The single-status and all-orders case: the server pages it.
  // Covers both the single-status tabs and "All Orders", where `statuses`
  // is empty and no status is sent — the server pages either the same way.
  const server = useQuery({
    queryKey: ['orders', 'list', tab.label, page],
    queryFn: () =>
      ordersApi.schoolOrders({ status: tab.statuses[0], page, page_size: PAGE_SIZE }),
    enabled: !multi,
    placeholderData: keepPreviousData,
  })

  // The two-status case: fetch both in full, then page here.
  const merged = useQuery({
    queryKey: ['orders', 'merged', tab.label],
    queryFn: async () => {
      const lists = await Promise.all(tab.statuses.map(fetchAll))
      return lists
        .flat()
        .sort((a, b) => b.order_date.localeCompare(a.order_date))
    },
    enabled: multi,
  })

  if (multi) {
    const all = merged.data ?? []
    const start = (page - 1) * PAGE_SIZE
    return {
      orders: all.slice(start, start + PAGE_SIZE),
      total: all.length,
      pageSize: PAGE_SIZE,
      isLoading: merged.isLoading,
      isFetching: merged.isFetching,
    }
  }

  const data = server.data
  return {
    orders: data?.results ?? [],
    total: data?.count ?? 0,
    // The size the server was asked for, so the page count matches the rows.
    pageSize: PAGE_SIZE,
    isLoading: server.isLoading,
    isFetching: server.isFetching,
  }
}
