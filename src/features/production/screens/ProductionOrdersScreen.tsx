/**
 * Production Orders — F17, F22.
 *
 * The queue of what the Tailoring Centers have been asked to make, with a
 * filter band and the create dialog.
 *
 * **Raising is leads only.** Warehouse staff and Finance read this list — a
 * clerk receives against it — but the button is not shown to them, because
 * `MasterDataAccess` refuses the write and a button that 403s is worse than
 * no button.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, FileText } from 'lucide-react'
import { Badge, Button, EmptyState, Pagination, SkeletonRows } from '@/components'
import { canRaiseProductionOrder } from '@/domain/access'
import { formatQuantity } from '@/domain/money'
import { fulfilmentTone } from '@/domain/production'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AppShell } from '@/features/shell/components/AppShell'
import { ProductionFilterBar } from '../components/ProductionFilterBar'
import {
  PRODUCTION_PAGE_SIZE,
  useProductionOrders,
  useTailoringCenters,
  useWarehouses,
  type ProductionFilters,
} from '../hooks/useProductionOrders'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const NO_FILTERS: ProductionFilters = {
  search: '',
  tailoringCenter: null,
  warehouse: null,
  status: null,
}

export function ProductionOrdersScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ProductionFilters>(NO_FILTERS)

  const mayRaise = canRaiseProductionOrder(user)

  const orders = useProductionOrders(page, filters)
  const centers = useTailoringCenters()
  const warehouses = useWarehouses()

  const total = orders.data?.count ?? 0

  /*
   * Search narrows the page on screen, not the whole table: the endpoint has
   * no search parameter, and pretending otherwise would silently miss orders
   * on other pages. The footer says which is happening.
   */
  const rows = useMemo(() => {
    const all = orders.data?.results ?? []
    const term = filters.search.trim().toLowerCase()
    if (!term) return all
    return all.filter((order) => order.number.toLowerCase().includes(term))
  }, [orders.data, filters.search])

  function changeFilters(next: ProductionFilters) {
    setFilters(next)
    // A filter changes what page 1 means; staying on page 4 of the old set
    // shows an empty table.
    setPage(1)
  }

  return (
    <AppShell title="Production orders" searchHint="PO or center">
      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Production Orders</h1>
          <p className="page-head__subtitle">
            Manage raw material allocation and tailoring production tracking sheets.
          </p>
        </div>

        {mayRaise && (
          <Button onClick={() => navigate('/production-orders/new')}>
            <FileText size={16} aria-hidden />
            Create Production Order
          </Button>
        )}
      </header>

      <ProductionFilterBar
        value={filters}
        onChange={changeFilters}
        centers={centers.data?.results ?? []}
        warehouses={warehouses.data?.results ?? []}
      />

      <div className="table-card">
        {orders.isLoading ? (
          <SkeletonRows rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              filters.search || filters.status || filters.tailoringCenter || filters.warehouse
                ? 'No orders match these filters'
                : 'No production orders yet'
            }
            body={
              filters.search || filters.status || filters.tailoringCenter || filters.warehouse
                ? 'Widen the filters, or clear them to see the whole queue.'
                : mayRaise
                  ? 'Raise one to ask a Tailoring Center to make garments for a warehouse.'
                  : 'When Central Office raises an order on a Tailoring Center, it appears here.'
            }
            icon={ClipboardList}
            action={
              mayRaise && !filters.search
                ? {
                    label: 'Create Production Order',
                    onClick: () => navigate('/production-orders/new'),
                  }
                : undefined
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="ledger ledger--production">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Tailoring Center</th>
                    <th>Dest. Warehouse</th>
                    <th className="ledger__num">SKUs</th>
                    <th className="ledger__num">Total Qty</th>
                    <th>Required By</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    /*
                      The whole row opens the order, not just the number — a
                      table of orders is a list of things to open. It stays a
                      real link too, so middle-click, ctrl-click and the
                      keyboard all still behave.
                    */
                    <tr
                      key={order.id}
                      className="ledger__row--clickable"
                      onClick={() => navigate(`/production-orders/${order.id}`)}
                    >
                      <td>
                        <a
                          className="ledger__link"
                          href={`/production-orders/${order.id}`}
                          onClick={(event) => {
                            // The row handler navigates; let modified clicks
                            // fall through to the browser.
                            if (!event.metaKey && !event.ctrlKey) event.preventDefault()
                          }}
                        >
                          {order.number}
                        </a>
                      </td>
                      <td>{order.tailoring_center_name}</td>
                      <td>{order.warehouse_name}</td>
                      <td className="ledger__num">{order.line_count} SKUs</td>
                      <td className="ledger__num ledger__strong">
                        {formatQuantity(order.total_quantity)}
                      </td>
                      <td>{formatDate(order.due_in_warehouse_date)}</td>
                      <td>
                        <Badge tone={fulfilmentTone(order.fulfilment_status)}>
                          {order.fulfilment_status_display}
                        </Badge>
                      </td>
                      <td>{formatDate(order.order_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-card__footer">
              {/*
                The search note sits *above* the pagination, never instead of
                it. Searching narrows what is visible on this page; it does
                not change how many pages there are, and swapping the control
                out for a sentence stranded the reader wherever they were.
              */}
              {filters.search && (
                <p className="table-card__note">
                  Showing {rows.length} of {orders.data?.results.length ?? 0} on this page
                  matching “{filters.search}”. Search covers the current page — clear it to
                  move through the rest.
                </p>
              )}

              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(total / PRODUCTION_PAGE_SIZE))}
                totalItems={total}
                pageSize={PRODUCTION_PAGE_SIZE}
                onChange={setPage}
                noun="production orders"
              />
            </div>
          </>
        )}
      </div>

    </AppShell>
  )
}
