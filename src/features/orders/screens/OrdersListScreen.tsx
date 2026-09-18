/**
 * Orders — Figma order-table.
 *
 * Header, a tab bar in its own card, the filter row, then the table card
 * with its Showing/Previous/Next footer.
 *
 * Tabs are the design's four groupings. Three are one status and so one
 * server request; "In Progress" spans RELEASED and PICKED, which the server
 * cannot filter in a single call — see `useOrders`.
 *
 * "New Student Order" is School Staff only. Finance may read every order and
 * place none, so it is hidden for them rather than shown disabled.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShoppingCart } from 'lucide-react'
import * as catalogApi from '@/api/catalog'
import { Button, Pagination, TabBar } from '@/components'
import { can, seesAllLocations } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AppShell } from '@/features/shell/components/AppShell'
import { OrderFilters, type OrderFilterState } from '../components/OrderFilters'
import { OrdersTable } from '../components/OrdersTable'
import { ORDER_TABS, useOrders } from '../hooks/useOrders'
import type { SchoolOrderStatus } from '@/api/types'

/** Every status, for the "All Orders" tab's status dropdown. */
const ALL_STATUSES: SchoolOrderStatus[] = [
  'HOLD',
  'RELEASED',
  'PICKED',
  'SHIPPED',
  'CANCELLED',
]

export function OrdersListScreen() {
  const { user } = useAuth()
  const [tabIndex, setTabIndex] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<OrderFilterState>({
    query: '',
    schoolId: null,
    status: null,
    orderDate: '',
  })

  const tab = ORDER_TABS[tabIndex]
  const { orders, total, pageSize, isLoading, isFetching } = useOrders(tab, page)

  const canPickSchool = seesAllLocations(user)
  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => catalogApi.schools(),
    enabled: canPickSchool,
    staleTime: 10 * 60 * 1000,
  })

  const visible = useMemo(() => {
    const needle = filters.query.trim().toLowerCase()
    return orders.filter((order) => {
      if (filters.schoolId !== null && order.school !== filters.schoolId) return false
      if (filters.status !== null && order.status !== filters.status) return false
      if (filters.orderDate && order.order_date !== filters.orderDate) return false
      if (!needle) return true
      return (
        order.number.toLowerCase().includes(needle) ||
        order.student_name.toLowerCase().includes(needle) ||
        order.school_name.toLowerCase().includes(needle)
      )
    })
  }, [orders, filters])

  const narrowed = visible.length !== orders.length
  const pageCount = Math.max(Math.ceil(total / pageSize), 1)

  function selectTab(index: number) {
    setTabIndex(index)
    setPage(1)
    // The status dropdown offers only what the new tab covers.
    setFilters((current) => ({ ...current, status: null }))
  }

  return (
    <AppShell title="Orders" searchHint="order or school">
      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Orders</h1>
          <p className="page-head__subtitle">
            Track nationwide student uniform allocations, billing, and release status.
          </p>
        </div>

        {can(user, 'school_orders') && (
          <Link to="/orders/new">
            <Button>
              <ShoppingCart size={16} aria-hidden />
              New Student Order
            </Button>
          </Link>
        )}
      </header>

      <TabBar
        label="Order groupings"
        tabs={ORDER_TABS.map((entry) => ({ key: entry.label, label: entry.label }))}
        active={ORDER_TABS[tabIndex].label}
        onSelect={(key) =>
          selectTab(ORDER_TABS.findIndex((entry) => entry.label === key))
        }
      />

      <OrderFilters
        value={filters}
        onChange={setFilters}
        schools={schools?.results ?? []}
        canPickSchool={canPickSchool}
        statuses={tab.statuses.length ? tab.statuses : ALL_STATUSES}
      />

      <div className="table-card" aria-busy={isFetching || undefined}>
        <OrdersTable orders={visible} loading={isLoading} />

        <div className="table-card__footer">
          {/* Always present. Hiding it while a filter was active made the
              control appear and disappear as you typed. The line above says
              when the page has been narrowed, so the two do not contradict
              each other. */}
          {narrowed && (
            <p className="pagination__position">
              Showing {visible.length} of {orders.length} on this page
            </p>
          )}

          <Pagination
            page={Math.min(page, pageCount)}
            pageCount={pageCount}
            totalItems={total}
            pageSize={pageSize}
            onChange={setPage}
            noun="orders"
          />
        </div>
      </div>
    </AppShell>
  )
}
