/**
 * Orders waiting for stock — F43, F44, F45.
 *
 * ---------------------------------------------------------------------------
 * The rule, in one sentence
 * ---------------------------------------------------------------------------
 * If a warehouse cannot fill every line of a paid order, nothing ships. The
 * order is held whole until stock arrives or somebody hands it to a warehouse
 * that has it.
 *
 * That is page 8 of AsOne's pack, and it is why this screen lists **orders**
 * rather than shortfalls. There is no part-shipping: a school never receives
 * a parcel with half the uniform in it, so one missing shirt holds the
 * trousers too.
 *
 * ---------------------------------------------------------------------------
 * There is nothing here to create, edit or resolve
 * ---------------------------------------------------------------------------
 * A backorder is not a record. An order is backordered when it is RELEASED
 * and its warehouse is short — that is the whole definition, derived on read
 * — and it stops being one the moment either changes. So there is no status
 * to set, no row to tidy up, and no "resolve" button: stock arriving removes
 * a row from this queue on its own.
 *
 * ---------------------------------------------------------------------------
 * Oldest first, and not re-sorted
 * ---------------------------------------------------------------------------
 * The server returns the queue in FIFO order, which is the rule rather than a
 * default — the sequence the schools placed them in, not the sequence
 * somebody opened them in. Sorting this table would quietly replace AsOne's
 * fairness rule with a preference.
 *
 * The shortfall is on the row rather than behind a click for the same reason:
 * a clerk is deciding between waiting for the next delivery and moving the
 * order, and cannot decide that without seeing what is missing.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, PackageCheck } from 'lucide-react'
import { Alert, Badge, Button, EmptyState, SkeletonRows, type Tone } from '@/components'
import { formatDay } from '@/domain/dates'
import { formatQuantity } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { TransferOrderModal } from '../components/TransferOrderModal'
import { useOrdersAwaitingStock } from '../hooks/useBackorders'
import type { OrderAwaitingStock } from '@/api/backorders'

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

export function BackordersScreen() {
  const { warehouseId, siteLabel } = useWarehouseFilter()
  const queue = useOrdersAwaitingStock(warehouseId)
  const [transferring, setTransferring] = useState<OrderAwaitingStock | null>(null)

  const rows = queue.data ?? []

  return (
    <AppShell title="Backorders" searchHint="order or school">
      <header className="page-head">
        <h1 className="page-head__title">Backorders</h1>
        <p className="page-head__subtitle">
          {/* `siteLabel` is "All warehouses" for a role that has them all,
              which turned this into "Paid orders All warehouses cannot fill
              yet". Named only when there is one site to name. */}
          {warehouseId === null
            ? 'Paid orders that cannot be filled yet.'
            : `Paid orders ${siteLabel} cannot fill yet.`}{' '}
          Nothing part-ships, so one short line holds the whole order — oldest
          first.
        </p>
      </header>

      {/*
        A failed query renders as an empty table, which here would read as
        "nothing is waiting" — the most reassuring possible lie for a queue
        whose whole job is to show what is stuck.
      */}
      {queue.isError && (
        <Alert tone="error">
          The queue could not be loaded, so this is not a list of what is
          waiting. Try again in a moment.
        </Alert>
      )}

      {rows.length > 0 && (
        <Alert tone="warning">
          {rows.length === 1
            ? '1 paid order is waiting for stock. It ships the moment every line can be filled.'
            : `${rows.length} paid orders are waiting for stock. Each ships the moment every line can be filled.`}
        </Alert>
      )}

      <div className="table-card">
        {queue.isLoading ? (
          <SkeletonRows rows={6} />
        ) : rows.length === 0 && !queue.isError ? (
          <EmptyState
            title="Nothing is waiting"
            body="An order appears here when it has been paid for and the warehouse responsible cannot fill every line. It leaves on its own as soon as stock arrives."
            icon={PackageCheck}
          />
        ) : (
          <div className="table-scroll">
            <table className="ledger ledger--awaiting">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>School</th>
                  <th>Placed</th>
                  <th>Waiting on</th>
                  <th>Priority</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.order.id}>
                    <td className="ledger__code">
                      <Link className="ledger__link" to={`/orders/${entry.order.id}`}>
                        {entry.order.number}
                      </Link>
                      {/*
                        Explains why a Namayemba school's order is being
                        packed at Serere. Without it the warehouse column
                        looks like a mistake.
                      */}
                      {entry.order.transferred_to_name && (
                        <span className="line-note">
                          Filled by {entry.order.transferred_to_name}
                        </span>
                      )}
                    </td>

                    <td className="ledger__nowrap">{entry.order.school_name}</td>
                    <td className="ledger__nowrap">{formatDay(entry.order.order_date)}</td>

                    <td>
                      {/*
                        Every short line, on the row. A count would say the
                        order is stuck; these say what would unstick it, and
                        that is what the clerk is deciding on.
                      */}
                      <ul className="shortfalls">
                        {entry.waiting_on.map((row) => (
                          <li key={row.sku} className="shortfalls__item">
                            <span className="shortfalls__sku">{row.sku}</span>
                            <span className="shortfalls__desc">{row.description}</span>
                            <span className="shortfalls__gap t-numeric">
                              short {formatQuantity(row.shortfall)} of{' '}
                              {formatQuantity(row.needed)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>

                    <td>
                      <Badge tone={priorityTone(entry.order.priority)}>
                        {entry.order.priority ?? 'NORMAL'}
                      </Badge>
                    </td>

                    <td className="ledger__num">
                      <Button size="sm" onClick={() => setTransferring(entry)}>
                        Transfer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/*
        No pagination. The queue is derived per request and is a handful of
        orders — and paging a FIFO queue would put the oldest, most urgent
        work on a page nobody looks at. If it ever grows past a screenful
        that is a warehouse problem worth seeing whole, not one to hide.
      */}
      {rows.length > 0 && (
        <p className="table-card__note">
          <Clock size={14} aria-hidden /> Oldest first. This is the order the
          schools placed them in, and it is the sequence the pack asks the
          warehouse to work down.
        </p>
      )}

      <TransferOrderModal entry={transferring} onClose={() => setTransferring(null)} />
    </AppShell>
  )
}
