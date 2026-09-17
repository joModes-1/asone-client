/**
 * Shipping — the picking backlog, F38.
 *
 * The landing view of the Shipments destination: what the warehouse has to
 * pull off the shelves, most urgent first, and the three counts above it.
 *
 * Two views share this destination — the backlog and what has already gone
 * out — so they share a tab strip. Both designs show the same sidebar item
 * selected, which is what tabs mean; an earlier version used a text link
 * reading "View despatched shipments", which was neither a pattern this
 * system has nor wording anybody asked for.
 *
 * ## Two things the design shows that cannot exist
 *
 * **"In Progress".** `pick_order` is atomic on the server — an order is
 * picked or it is not — because a half-finished reservation would let the
 * ledger say stock is committed to an order nobody completed. Whether
 * picking should be resumable is AsOne's open question Q4 ("can an order be
 * part-shipped?"), still unanswered. Until it is, an in-progress badge would
 * be a state nothing could reach.
 *
 * So the middle tile counts orders **picked and waiting for a van**, which
 * is the real thing sitting between ready and gone.
 *
 * **Per-line checkboxes with a 4/7 progress bar.** Same reason. The printed
 * pick list is the sheet a clerk ticks; the system records the outcome.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Boxes, CheckCircle2, Clock, PackageCheck } from 'lucide-react'
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Pagination,
  SkeletonRows,
  TabBar,
  type Tone,
} from '@/components'
import { canReceiveAndShip } from '@/domain/access'
import { AppShell } from '@/features/shell/components/AppShell'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import type { PickingStatus } from '@/api/shipments'
import { DespatchQueue } from '../components/DespatchQueue'
import { PICKING_PAGE_SIZE, usePickOrder, usePickingQueue } from '../hooks/useShipments'

/**
 * The backlog holds exactly two statuses, so the filter offers exactly two
 * and neither is invented. "In progress" is not among them for the reason at
 * the top of this file: `pick_order` is atomic.
 */
const STATUS_FILTERS: { value: '' | PickingStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'RELEASED', label: 'Not picked' },
  { value: 'PICKED', label: 'Picked' },
]

/** Urgency is the warehouse's own hint; nothing in the system acts on it. */
function priorityTone(priority: string | undefined): Tone {
  switch (priority) {
    case 'URGENT':
      return 'error'
    case 'HIGH':
      return 'warning'
    default:
      return 'neutral'
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
  })
}

export function PickingScreen() {
  const { user } = useAuth()
  const { warehouseId } = useWarehouseFilter()
  const navigate = useNavigate()
  const [picking, setPicking] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<'' | PickingStatus>('')

  const queue = usePickingQueue(warehouseId, page, status || null)
  const pick = usePickOrder()
  const mayPick = canReceiveAndShip(user)

  const summary = queue.data?.summary
  const orders = queue.data?.orders.results ?? []
  const total = queue.data?.orders.count ?? 0

  return (
    <AppShell title="Shipping" searchHint="order or school">
      <header className="page-head">
        <h1 className="page-head__title">Shipping</h1>
        <p className="page-head__subtitle">
          What is waiting to be picked, and what is ready to go out.
        </p>

      </header>

      <TabBar
        label="Shipping views"
        active="picking"
        onSelect={(key) => key === 'history' && navigate('/shipments/history')}
        tabs={[
          { key: 'picking', label: 'To Pick' },
          { key: 'history', label: 'Despatched' },
        ]}
      />

      <div className="kpi-row">
        <KpiCard
          label="Ready to Pick"
          value={summary ? String(summary.ready_to_pick) : '—'}
          caption="Paid for, awaiting warehouse action"
          icon={Clock}
          tone={summary && summary.ready_to_pick > 0 ? 'alert' : 'default'}
        />
        <KpiCard
          label="Picked"
          value={summary ? String(summary.picked) : '—'}
          caption="Reserved and waiting for a van"
          icon={Boxes}
        />
        <KpiCard
          label="Completed Today"
          value={summary ? String(summary.completed_today) : '—'}
          caption="Orders picked off the shelves today"
          icon={CheckCircle2}
        />
      </div>

      <DespatchQueue />

      <section className="table-card">
        <header className="table-card__head">
          <h2 className="table-card__title">Order Picking Backlog</h2>

          {/*
            Same `.filter-bar` markup as transfers, shipments and production
            orders, so this reads as the one control the rest of the system
            uses rather than a second way of doing the same thing.

            Narrowing returns to page one. Staying on page four of a list
            that now has one page shows an empty table and looks like the
            filter matched nothing.
          */}
          <div className="filter-bar filter-bar--inline">
            <label className="filter-bar__field">
              <span>Status:</span>
              <select
                aria-label="Filter the backlog by status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as '' | PickingStatus)
                  setPage(1)
                }}
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {queue.isLoading ? (
          <SkeletonRows rows={6} />
        ) : orders.length === 0 ? (
          <EmptyState
            title={
              status === 'PICKED'
                ? 'Nothing picked yet'
                : status === 'RELEASED'
                  ? 'Nothing left to pick'
                  : 'Nothing waiting to be picked'
            }
            body={
              status
                ? 'The filter above is narrowing this table. Set it back to All to see the whole backlog.'
                : 'An order appears here once Finance confirms payment and releases it to the warehouse.'
            }
            icon={PackageCheck}
          />
        ) : (
          <div className="table-scroll">
            <table className="ledger ledger--production">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>School</th>
                  <th>Student Target</th>
                  <th>SKU Sample</th>
                  <th className="ledger__num">Items</th>
                  <th>Priority</th>
                  <th>Created</th>
                  <th>Status</th>
                  {/* Not drawn at all for a role that cannot pick — a
                      column of dead buttons is worse than no column. A lead
                      reads this backlog; the warehouse works it. */}
                  {mayPick && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const ready = order.status === 'RELEASED'

                  return (
                    <tr key={order.id}>
                      <td>
                        <Link className="ledger__link" to={`/orders/${order.id}`}>
                          {order.number}
                        </Link>
                      </td>
                      <td className="ledger__strong">{order.school_name}</td>
                      <td>{order.student_name}</td>
                      <td className="ledger__wrap">{order.sku_sample.join(', ')}</td>
                      <td className="ledger__num">{order.item_count}</td>
                      <td>
                        <Badge tone={priorityTone(order.priority)}>
                          {order.priority_display}
                        </Badge>
                      </td>
                      <td>{formatDate(order.order_date)}</td>
                      <td>
                        <Badge tone={ready ? 'info' : 'success'}>
                          {ready ? 'Ready' : 'Completed'}
                        </Badge>
                      </td>
                      {mayPick && (
                      <td className="ledger__num">
                        {ready ? (
                          /*
                            Picking reserves stock the moment it is clicked,
                            and the wrong click refuses the next school's
                            order for a shortfall that is not real. Worth one
                            question before it happens.
                          */
                          <ConfirmButton
                            size="sm"
                            title={`Pick ${order.number}?`}
                            confirmLabel="Yes, pick it"
                            pendingLabel="Picking…"
                            pending={picking === order.id}
                            note={`Reserves ${order.item_count} garments for ${order.student_name}. They stop being available to any other order.`}
                            onConfirm={() => {
                              setPicking(order.id)
                              pick.mutate(order.id, {
                                onSettled: () => setPicking(null),
                              })
                            }}
                          >
                            Start Pick
                          </ConfirmButton>
                        ) : (
                          /*
                            Done, and it stays on screen as a spent control
                            rather than vanishing — the design keeps the
                            button in place so the row still reads as a row.
                            Printing the pick list and undoing the pick both
                            live on the order itself, which is where a clerk
                            goes to look at one.
                          */
                          <Button size="sm" disabled>
                            Picked
                          </Button>
                        )}
                      </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {orders.length > 0 && (
          <div className="table-card__footer">
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(total / PICKING_PAGE_SIZE))}
              totalItems={total}
              pageSize={PICKING_PAGE_SIZE}
              onChange={setPage}
              noun="orders"
            />
          </div>
        )}
      </section>
    </AppShell>
  )
}
