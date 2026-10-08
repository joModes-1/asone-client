/**
 * Group Orders — the consolidated seasonal requirement.
 *
 * AsOne's p.2: "the consolidated uniform requirements total across all 3
 * Tailoring Centers. Used to initially fund the TCs." One document per
 * season, not per site — which is why this list is short and the detail
 * screen is where the work is.
 *
 * **Raising is leads only.** Finance reads the list; warehouse and school
 * staff never reach it, because the nav entry is hidden rather than left to
 * 403. Same rule as Production Orders beside it.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileStack, FileText, Search } from 'lucide-react'
import { Badge, Button, EmptyState, Pagination, SkeletonRows } from '@/components'
import { canRaiseProductionOrder } from '@/domain/access'
import { formatQuantity, formatUGX } from '@/domain/money'
import { fulfilmentTone } from '@/domain/production'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AppShell } from '@/features/shell/components/AppShell'
import { GROUP_ORDER_PAGE_SIZE, useGroupOrders } from '../hooks/useGroupOrders'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/*
 * Only the three the server has. A group order carries `status`, not the
 * derived `fulfilment_status` a production order does — there are no receipts
 * against a group order, so there is nothing to derive.
 */
const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const

export function GroupOrdersScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const mayRaise = canRaiseProductionOrder(user)
  const orders = useGroupOrders(page, status)

  const all = useMemo(() => orders.data?.results ?? [], [orders.data])
  const total = orders.data?.count ?? 0

  /*
   * Search narrows the page on screen, not the whole table. The endpoint's
   * `filterset_fields` is status and order_date only — there is no search
   * parameter — and pretending otherwise would silently hide orders sitting
   * on other pages. The footer says which is happening.
   */
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return all
    return all.filter(
      (order) =>
        order.number.toLowerCase().includes(term) ||
        (order.notes ?? '').toLowerCase().includes(term),
    )
  }, [all, search])

  return (
    <AppShell title="Group orders">
      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Group Orders</h1>
          <p className="page-head__subtitle">
            The season&rsquo;s whole requirement, across all three Tailoring
            Centers. Production orders break it down.
          </p>
        </div>

        {mayRaise && (
          <Button onClick={() => navigate('/group-orders/new')}>
            <FileText size={16} aria-hidden />
            Create Group Order
          </Button>
        )}
      </header>

      <div className="filter-bar">
        <label className="filter-bar__search filter-bar__search--compact">
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder="Search number or notes…"
            aria-label="Search group orders"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="filter-bar__field">
          <span>Status:</span>
          <select
            aria-label="Status"
            value={status ?? ''}
            onChange={(event) => {
              setStatus(event.target.value || null)
              // A filter changes what page 1 means; staying on page 3 of the
              // old set shows an empty table.
              setPage(1)
            }}
          >
            {STATUSES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-card">
        {orders.isLoading ? (
          <SkeletonRows rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              search
                ? 'No group orders on this page match that search'
                : status
                  ? 'No group orders match this status'
                  : 'No group orders yet'
            }
            body={
              search
                ? 'Search looks at the page you are on. Clear it, or move through the pages, to see the rest.'
                : status
                ? 'Clear the filter to see the whole list.'
                : mayRaise
                  ? 'Raise one to record the season’s total requirement before the Tailoring Centers are asked for their share of it.'
                  : 'When Central Office raises the season’s requirement, it appears here.'
            }
            icon={FileStack}
            action={
              mayRaise && !status && !search
                ? { label: 'Create Group Order', onClick: () => navigate('/group-orders/new') }
                : undefined
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="ledger ledger--group-orders">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Order Date</th>
                    <th>Required By</th>
                    <th className="ledger__num">SKUs</th>
                    <th className="ledger__num">Total Qty</th>
                    <th className="ledger__num">Total Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    /*
                      The whole row opens the order — a table of orders is a
                      list of things to open. It stays a real link so
                      middle-click, ctrl-click and the keyboard still behave.
                    */
                    <tr
                      key={order.id}
                      className="ledger__row--clickable"
                      onClick={() => navigate(`/group-orders/${order.id}`)}
                    >
                      <td>
                        <a
                          className="ledger__link"
                          href={`/group-orders/${order.id}`}
                          onClick={(event) => {
                            if (!event.metaKey && !event.ctrlKey) event.preventDefault()
                          }}
                        >
                          {order.number}
                        </a>
                      </td>
                      <td>{formatDate(order.order_date)}</td>
                      <td>{formatDate(order.due_in_warehouse_date)}</td>
                      <td className="ledger__num">{order.lines.length}</td>
                      <td className="ledger__num ledger__strong">
                        {formatQuantity(order.total_quantity)}
                      </td>
                      <td className="ledger__num t-numeric">{formatUGX(order.total_value)}</td>
                      <td>
                        {/* Shares the procurement tone map with production
                            orders: OPEN, CLOSED and CANCELLED mean the same
                            thing on both documents. */}
                        <Badge tone={fulfilmentTone(order.status ?? 'OPEN')}>
                          {order.status_display}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-card__footer">
              {/*
                The search note sits *above* the pagination, never instead of
                it. Searching narrows what is visible on this page; it does
                not change how many pages there are.
              */}
              {search && (
                <p className="table-card__note">
                  Showing {rows.length} of {all.length} on this page matching
                  &ldquo;{search}&rdquo;. Search covers the current page &mdash;
                  clear it to move through the rest.
                </p>
              )}

              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(total / GROUP_ORDER_PAGE_SIZE))}
                totalItems={total}
                pageSize={GROUP_ORDER_PAGE_SIZE}
                onChange={setPage}
                noun="group orders"
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
