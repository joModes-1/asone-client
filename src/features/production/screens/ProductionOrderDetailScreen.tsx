/**
 * One production order — the manifest and what has come back against it.
 *
 * Breadcrumb, heading with the derived fulfilment badge, three fact cards,
 * then the SKU manifest on the left and the receipt history on the right.
 *
 * ## Three things the design draws that the data cannot support
 *
 * **"IN PRODUCTION".** Tailoring Centers are not system users — AsOne was
 * explicit that the packing list arrives handwritten, on paper, with the
 * goods. Nothing can tell us a centre has started cutting. The badge shows
 * what the documents actually say: awaiting delivery, partially received,
 * received, closed. See `domain/production.ts`.
 *
 * **The QR code** on "Print Manifest & QR". Nothing in the system issues
 * one and nothing scans one, so the button prints the manifest and says so
 * rather than printing a code that resolves to nothing.
 *
 * **A TC contact name and a warehouse street address.** Neither is on the
 * catalogue records, so the cards show what is there.
 *
 * "Shipped" in the manifest table *is* real: it is the quantity the TC's
 * packing lists claimed, which the server keeps separate from what was
 * counted. That difference is the whole of F20.
 */

import { Link, useParams } from 'react-router-dom'
import { Ban, ChevronRight, Printer } from 'lucide-react'
import { Badge, Button, ConfirmButton, LoadingScreen, SkeletonRows } from '@/components'
import { formatQuantity } from '@/domain/money'
import { fulfilmentTone } from '@/domain/production'
import { relativeTime } from '@/domain/dates'
import { canRaiseProductionOrder, canReceiveAndShip } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AppShell } from '@/features/shell/components/AppShell'
import {
  useCancelProductionOrder,
  usePostReceipt,
  useOrderOutstanding,
  useOrderReceipts,
  useProductionOrder,
} from '../hooks/useProductionOrders'

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ProductionOrderDetailScreen() {
  const { orderId } = useParams()
  const id = Number(orderId)

  const { user } = useAuth()
  const { data: order, isLoading, isError } = useProductionOrder(id)
  const manifest = useOrderOutstanding(id)
  const receipts = useOrderReceipts(id)
  const cancel = useCancelProductionOrder(id)
  const postReceipt = usePostReceipt()
  const canReceive = canReceiveAndShip(user)

  if (isLoading) return <LoadingScreen message="Loading production order" />

  if (isError || !order) {
    return (
      <AppShell title="Production orders">
        <p className="panel__clear">That production order could not be loaded.</p>
      </AppShell>
    )
  }

  const rows = manifest.data ?? []
  const history = receipts.data?.results ?? []

  return (
    <AppShell title="Production orders">
      <nav className="crumbs no-print" aria-label="Breadcrumb">
        <Link to="/production-orders">Production Orders</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">{order.number}</span>
      </nav>

      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title detail-head__title">
            Order {order.number}
            <Badge tone={fulfilmentTone(order.fulfilment_status)}>
              {order.fulfilment_status_display}
            </Badge>
          </h1>
          <p className="page-head__subtitle">
            Created on {formatDateTime(order.created_at)} by {order.created_by_name}
          </p>
        </div>

        <div className="detail-head__actions no-print">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} aria-hidden />
            Print Manifest
          </Button>

          {/*
            Cancelling is the only amendment the screens offer, and the same
            column that raises an order — what to ask a Tailoring Centre to
            make, and whether to stop asking, is one decision.

            Hidden once anything has arrived, rather than shown and refused:
            the server will not cancel an order goods were received against,
            and offering a button that always fails is worse than not having
            one. `fulfilment_status` is AWAITING only while nothing has come.
          */}
          {canRaiseProductionOrder(user) &&
            order.status === 'OPEN' &&
            order.fulfilment_status === 'AWAITING' && (
              <ConfirmButton
                variant="secondary"
                title={`Cancel ${order.number}?`}
                confirmLabel="Cancel the order"
                pendingLabel="Cancelling…"
                pending={cancel.isPending}
                note={`${order.tailoring_center_name} will no longer be expected to deliver this, and it stops counting as stock on its way. The order itself is kept.`}
                onConfirm={() => cancel.mutate()}
              >
                <Ban size={16} aria-hidden />
                Cancel Order
              </ConfirmButton>
            )}
        </div>
      </header>

      <div className="fact-cards">
        <section className="fact-card">
          <p className="fact-card__label">Tailoring Center</p>
          <p className="fact-card__value">{order.tailoring_center_name}</p>
          <p className="fact-card__note">Supplier for this order</p>
        </section>

        <section className="fact-card">
          <p className="fact-card__label">Destination Hub</p>
          <p className="fact-card__value">{order.warehouse_name}</p>
          <p className="fact-card__note">Where the goods are received</p>
        </section>

        <section className="fact-card">
          <p className="fact-card__label">Requirements Metric</p>
          <p className="fact-card__value">Required: {formatDate(order.due_in_warehouse_date)}</p>
          <p className="fact-card__note">
            {order.line_count} SKUs · {formatQuantity(order.total_quantity)} physical uniforms
          </p>
        </section>
      </div>

      <div className="detail-columns">
        <section className="card-panel">
          <h2 className="card-panel__title card-panel__title--accent">
            Detailed SKU Manifest Tracking
          </h2>

          {manifest.isLoading ? (
            <SkeletonRows rows={5} />
          ) : rows.length === 0 ? (
            <p className="panel__clear">This order has no lines.</p>
          ) : (
            <div className="table-scroll">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Description</th>
                    <th className="ledger__num">Ordered</th>
                    <th className="ledger__num">Shipped</th>
                    <th className="ledger__num">Received</th>
                    <th className="ledger__num">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.sku}>
                      <td className="ledger__code">{row.sku_number}</td>
                      <td className="ledger__wrap">{row.sku_description}</td>
                      <td className="ledger__num">{formatQuantity(row.ordered)}</td>
                      <td className="ledger__num">{formatQuantity(row.shipped)}</td>
                      <td className="ledger__num">{formatQuantity(row.received)}</td>
                      {/* Anything still owed is the reason to look at this
                          table, so it is the only figure that shouts. */}
                      <td
                        className={`ledger__num${
                          row.outstanding > 0 ? ' ledger__num--owed' : ''
                        }`}
                      >
                        {row.outstanding}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card-panel">
          <h2 className="card-panel__title card-panel__title--accent">Receipt History Logs</h2>

          {receipts.isLoading ? (
            <SkeletonRows rows={3} />
          ) : (
            <ol className="history">
              {history.map((receipt) => {
                const units = (receipt.lines ?? []).reduce(
                  (sum, line) => sum + line.quantity_received,
                  0,
                )

                return (
                  <li className="history__item" key={receipt.id}>
                    <span
                      className={`history__dot${
                        receipt.is_posted ? '' : ' history__dot--pending'
                      }`}
                      aria-hidden
                    />
                    <div>
                      <p className="history__title">
                        Delivery Receipt {receipt.number}{' '}
                        {receipt.is_posted ? 'confirmed' : 'recorded — not posted'}
                      </p>
                      <p className="history__body">
                        {formatQuantity(units)} items
                        {receipt.is_posted ? ' processed into ' : ' awaiting posting at '}
                        {receipt.warehouse_name} by {receipt.created_by_name}
                        {receipt.has_discrepancy && ' · discrepancy recorded'}
                      </p>
                      <p className="history__when">
                        {formatDateTime(receipt.created_at)} · {relativeTime(receipt.created_at)}
                      </p>

                      {/*
                        Recording a receipt and posting it to the ledger are
                        two calls. When the second fails the first has already
                        succeeded — a numbered receipt exists and no stock was
                        raised, which every availability check is then wrong
                        about. The message at the time says to post it from
                        the receipt; this is where that happens.
                      */}
                      {!receipt.is_posted && canReceive && (
                        <div className="history__action">
                          <ConfirmButton
                            size="sm"
                            title={`Post ${receipt.number} to inventory?`}
                            confirmLabel="Raise the stock"
                            pendingLabel="Posting…"
                            pending={postReceipt.isPending}
                            note={`Raises ${formatQuantity(units)} units at ${receipt.warehouse_name} and writes a permanent ledger row. This cannot be undone.`}
                            onConfirm={() => postReceipt.mutate(receipt.id)}
                          >
                            Post to inventory
                          </ConfirmButton>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}

              {/* The order itself is the first thing that happened to it, and
                  a log that starts at the first delivery loses that. */}
              <li className="history__item" key="raised">
                <span className="history__dot history__dot--muted" aria-hidden />
                <div>
                  <p className="history__title">Order raised on {order.tailoring_center_name}</p>
                  <p className="history__body">
                    {formatQuantity(order.total_quantity)} units across {order.line_count} SKUs,
                    for delivery into {order.warehouse_name}.
                  </p>
                  <p className="history__when">{formatDateTime(order.created_at)}</p>
                </div>
              </li>
            </ol>
          )}
        </section>
      </div>
    </AppShell>
  )
}
