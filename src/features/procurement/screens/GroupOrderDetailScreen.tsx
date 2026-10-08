/**
 * One group order — its lines, and the reconciliation against the production
 * orders breaking it down.
 *
 * ---------------------------------------------------------------------------
 * The reconciliation is the screen
 * ---------------------------------------------------------------------------
 * AsOne's spec says production orders "should initially sum up to the Group
 * Order". That sentence is the only control they asked for on this document,
 * and without it a group order is a list nobody would open twice.
 *
 * So the table reads `requested` (on this order), `ordered` (across its
 * production orders) and the difference. **Negative means the Tailoring
 * Centers have been asked for less than the requirement** — the case worth
 * chasing, and the only one drawn in a colour.
 *
 * ---------------------------------------------------------------------------
 * Reported, never enforced
 * ---------------------------------------------------------------------------
 * A positive difference is not an error. A warehouse ordering a little extra
 * is a judgement call — safety stock, a school that grew — and blocking it
 * would block exactly the decisions a person is there to make. The screen
 * informs; it does not refuse, and it offers no button to "fix" a row.
 *
 * Cancelled production orders are excluded server-side, so a withdrawn order
 * cannot quietly flatter the comparison.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Ban, ChevronRight, TriangleAlert } from 'lucide-react'
import {
  Badge,
  ConfirmButton,
  LoadingScreen,
  Pagination,
  SkeletonRows,
} from '@/components'
import { canRaiseProductionOrder } from '@/domain/access'
import { formatQuantity, formatUGX } from '@/domain/money'
import { fulfilmentTone } from '@/domain/production'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AppShell } from '@/features/shell/components/AppShell'
import {
  useAmendGroupOrder,
  useGroupOrder,
  useGroupOrderReconciliation,
} from '../hooks/useGroupOrders'

/*
 * Both tables are paged on the client, because both arrive whole: the lines
 * are embedded in the order and the reconciliation is a bare array. That is
 * right for the data — a comparison you can only read half of is not a
 * comparison — but it is wrong for the screen once a season's requirement
 * runs to three hundred SKUs, which the 2027 catalogue does.
 *
 * Twelve, matching the inventory table. The shortfall banner above counts
 * **every** row, not the page, so a reader never has to walk the pages to
 * find out whether anything is short.
 */
const ROWS_PER_PAGE = 12

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function GroupOrderDetailScreen() {
  const { groupOrderId } = useParams()
  const id = Number(groupOrderId)
  const { user } = useAuth()

  const [reconPage, setReconPage] = useState(1)
  const [linePage, setLinePage] = useState(1)

  const orderQuery = useGroupOrder(id)
  const reconciliation = useGroupOrderReconciliation(id)
  const amend = useAmendGroupOrder(id)

  const order = orderQuery.data
  const rows = reconciliation.data ?? []

  /*
   * Only shortfalls. A surplus is a decision somebody made, not a problem to
   * surface — see the note at the top of this file.
   */
  const short = rows.filter((row) => row.difference < 0)

  // Clamped rather than stored: a row count that shrinks under a reader
  // sitting on page 4 would otherwise strand them on an empty table.
  const reconPageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE))
  const reconSafe = Math.min(reconPage, reconPageCount)
  const visibleRows = rows.slice((reconSafe - 1) * ROWS_PER_PAGE, reconSafe * ROWS_PER_PAGE)

  const lines = order?.lines ?? []
  const linePageCount = Math.max(1, Math.ceil(lines.length / ROWS_PER_PAGE))
  const lineSafe = Math.min(linePage, linePageCount)
  const visibleLines = lines.slice((lineSafe - 1) * ROWS_PER_PAGE, lineSafe * ROWS_PER_PAGE)

  if (orderQuery.isLoading) return <LoadingScreen message="Loading the group order" />
  if (!order) {
    return (
      <AppShell title="Group orders">
        <p className="panel__clear">That group order could not be found.</p>
      </AppShell>
    )
  }

  return (
    <AppShell title="Group orders">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/group-orders">Group Orders</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">{order.number}</span>
      </nav>

      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">
            {order.number}{' '}
            <Badge tone={fulfilmentTone(order.status ?? 'OPEN')}>{order.status_display}</Badge>
          </h1>
          <p className="page-head__subtitle">
            Raised by {order.created_by_name} on {formatDate(order.order_date)}.
          </p>
        </div>

        {/*
          Hidden unless the order is open and the reader may write. Cancelling
          is a status change, never a delete: the document is what funded the
          centres and the production orders underneath still point at it.
        */}
        {canRaiseProductionOrder(user) && order.status === 'OPEN' && (
          <ConfirmButton
            variant="secondary"
            title={`Cancel ${order.number}?`}
            confirmLabel="Cancel the order"
            pendingLabel="Cancelling…"
            pending={amend.isPending}
            note="The requirement stops standing, but the document and any production orders raised against it are kept."
            onConfirm={() => amend.mutate({ status: 'CANCELLED' })}
          >
            <Ban size={16} aria-hidden />
            Cancel Order
          </ConfirmButton>
        )}
      </header>

      <div className="fact-cards">
        <section className="fact-card">
          <p className="fact-card__label">Required In Warehouse</p>
          <p className="fact-card__value">{formatDate(order.due_in_warehouse_date)}</p>
          <p className="fact-card__note">When the season needs the goods</p>
        </section>

        <section className="fact-card">
          <p className="fact-card__label">Total Requirement</p>
          <p className="fact-card__value">{formatQuantity(order.total_quantity)} units</p>
          <p className="fact-card__note">
            {order.lines.length} line{order.lines.length === 1 ? '' : 's'}
          </p>
        </section>

        <section className="fact-card">
          <p className="fact-card__label">Total Value</p>
          <p className="fact-card__value">{formatUGX(order.total_value)}</p>
          <p className="fact-card__note">At the prices on the order date</p>
        </section>
      </div>

      {order.notes && (
        <section className="detail-notes">
          <p className="detail-notes__title">Notes</p>
          <p className="detail-notes__body">{order.notes}</p>
        </section>
      )}

      {/*
        The banner, above both tables. The shortfall is the reason to open
        this screen, and a reader who scrolls past the lines to find it is a
        reader who will not look.
      */}
      {!reconciliation.isLoading && short.length > 0 && (
        <p className="callout callout--warning">
          <TriangleAlert size={16} aria-hidden />
          <span>
            <strong>
              {short.length === 1
                ? 'One garment has been under-ordered'
                : `${short.length} garments have been under-ordered`}
            </strong>{' '}
            — the Tailoring Centers have been asked for less than this
            requirement. That is reported, not blocked: raise or amend a
            production order to close the gap, or leave it if the shortfall is
            deliberate.
          </span>
        </p>
      )}

      {/*
        Stacked full width, not `detail-columns` like the production order
        detail beside it. That grid pins its right column at 420px, which
        suits the receipt *list* it was built for and clips a five-column
        table — the lines table lost Quantity, Unit Price and Line Total off
        the right edge. Both tables here are documents to read across.
      */}
      <section className="card-panel">
          <h2 className="card-panel__title card-panel__title--accent">
            Requirement vs Ordered
          </h2>

          {reconciliation.isLoading ? (
            <SkeletonRows rows={5} />
          ) : reconciliation.isError ? (
            /*
              Not a silent zero. If the comparison failed, the lines beside it
              are still correct but the reader has lost the one check that says
              whether the centres were asked for the right amount.
            */
            <p className="callout callout--warning">
              <TriangleAlert size={16} aria-hidden />
              The comparison could not be loaded, so this order has not been
              checked against its production orders.
            </p>
          ) : rows.length === 0 ? (
            <p className="panel__clear">
              No production orders have been raised against this group order
              yet, so there is nothing to compare.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Description</th>
                    <th className="ledger__num">Requested</th>
                    <th className="ledger__num">Ordered</th>
                    <th className="ledger__num">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.sku_number}>
                      <td className="ledger__code">{row.sku_number}</td>
                      <td className="ledger__wrap">{row.sku_description}</td>
                      <td className="ledger__num">{formatQuantity(row.requested)}</td>
                      <td className="ledger__num">{formatQuantity(row.ordered)}</td>
                      {/* The shortfall is the reason to read this table, so
                          it is the only figure that shouts. A surplus is a
                          decision, and reads as an ordinary number.

                          `--owed` rather than a new class: it is the same
                          statement the production order manifest makes with
                          it — this much is still owed to somebody. */}
                      <td
                        className={`ledger__num t-numeric${
                          row.difference < 0 ? ' ledger__num--owed' : ''
                        }`}
                      >
                        {row.difference > 0 ? '+' : ''}
                        {formatQuantity(row.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!reconciliation.isLoading && rows.length > ROWS_PER_PAGE && (
            <div className="table-card__footer">
              <Pagination
                page={reconSafe}
                pageCount={reconPageCount}
                totalItems={rows.length}
                pageSize={ROWS_PER_PAGE}
                onChange={setReconPage}
                noun="garments"
              />
            </div>
          )}

          <p className="field__hint">
            Requested is what this order asks for. Ordered is the total across
            every production order raised against it, cancelled ones excluded.
          </p>
      </section>

      <section className="card-panel">
          <h2 className="card-panel__title card-panel__title--accent">
            SKUs On This Order
          </h2>

          <div className="table-scroll">
            <table className="ledger">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Description</th>
                  <th className="ledger__num">Quantity</th>
                  <th className="ledger__num">Unit Price</th>
                  <th className="ledger__num">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((line) => (
                  <tr key={line.id}>
                    <td className="ledger__code">{line.sku_number}</td>
                    <td className="ledger__wrap">{line.sku_description}</td>
                    <td className="ledger__num">{formatQuantity(line.quantity)}</td>
                    <td className="ledger__num t-numeric">{formatUGX(line.unit_price)}</td>
                    <td className="ledger__num t-numeric">{formatUGX(line.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lines.length > ROWS_PER_PAGE && (
            <div className="table-card__footer">
              <Pagination
                page={lineSafe}
                pageCount={linePageCount}
                totalItems={lines.length}
                pageSize={ROWS_PER_PAGE}
                onChange={setLinePage}
                /* "SKUs", like the heading above it and the column on
                   the group order list. One word for one thing. */
                noun="SKUs"
              />
            </div>
          )}

          <p className="field__hint">
            Prices were fixed when the order was raised and are not
            recalculated, so this total still matches what the centres were
            funded against.
          </p>
      </section>
    </AppShell>
  )
}
