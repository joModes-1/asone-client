/**
 * Procurement Costs — F55 and F56, on one screen.
 *
 * ---------------------------------------------------------------------------
 * Why both reports share a screen, and why they are not subtracted
 * ---------------------------------------------------------------------------
 * Both are procurement money over the same period, so they share one period
 * control and one export. **Committed** is what AsOne asked for on group
 * orders; **received** is what the Tailoring Centres actually delivered.
 *
 * They are shown side by side and **deliberately never netted off**. A group
 * order is a consolidated requirement, and a production order does not need
 * one — reorders and emergency orders through the year have none at all. So
 * receipts routinely exceed group-order value, and "committed minus received"
 * produces a large negative number that means nothing. The first draft of
 * this screen had exactly that tile, reading −UGX 140M against real data.
 *
 * What the two figures are for is being read, not differenced: one says what
 * was planned centrally, the other what arrived.
 *
 * ---------------------------------------------------------------------------
 * Two things about the figures
 * ---------------------------------------------------------------------------
 * **Everything is priced at the day, not today.** A group order is costed at
 * the price agreed when it was raised, and a receipt at the price on the
 * production order line — never at the current price list. Stock is worth
 * what was paid for it.
 *
 * **Received is what was counted**, not what was ordered and not what the
 * packing list claimed. A short delivery is worth less, and this is the
 * report where that shows.
 *
 * Cancelled group orders are out by default: a withdrawn commitment is not a
 * cost, and counting it would overstate every period it falls in. The toggle
 * is there because "what did we cancel" is a real question, just not the
 * default one.
 */

import { useState } from 'react'
import { ArrowLeft, Coins, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Alert, EmptyState, SkeletonRows, snackbar } from '@/components'
import { downloadFile, toCsv } from '@/domain/csv'
import { formatQuantity, formatUGX } from '@/domain/money'
import { formatDay } from '@/domain/dates'
import { AppShell } from '@/features/shell/components/AppShell'
import { ExportControls } from '../components/ExportControls'
import {
  useGroupOrdersCosted,
  useReceiptsCosted,
  type CostedPeriod,
} from '../hooks/useCostedReports'

/* No bounds to start. Unlike a stock figure, a cost report opens on the whole
   record — Finance narrows to a term or a quarter, and a default window would
   silently exclude what they came to add up. */
const ALL_TIME: CostedPeriod = { from: '', to: '' }

export function ProcurementCostScreen() {
  const [period, setPeriod] = useState<CostedPeriod>(ALL_TIME)
  const [includeCancelled, setIncludeCancelled] = useState(false)

  const committed = useGroupOrdersCosted(period, includeCancelled)
  const received = useReceiptsCosted(period)

  const orders = committed.data?.orders ?? []
  const centres = received.data?.by_tailoring_center ?? []
  const totals = committed.data?.totals

  const receivedValue = centres.reduce((sum, row) => sum + Number(row.value), 0)
  const receivedUnits = centres.reduce((sum, row) => sum + row.quantity, 0)

  function exportCsv() {
    const filename = `asone-procurement-costs-${period.from || 'all'}-${period.to || 'all'}.csv`
    downloadFile(
      filename,
      toCsv(
        ['Report', 'Reference', 'Date', 'Status', 'Units', 'Value (UGX)'],
        [
          // The raw decimal strings, not the formatted figures — a
          // spreadsheet wants numbers it can total.
          ...orders.map((row) => [
            'Committed',
            row.number,
            row.order_date,
            row.status,
            row.quantity,
            row.value,
          ]),
          ...centres.map((row) => [
            'Received',
            row.tailoring_center_name,
            '',
            `${row.receipts} receipts`,
            row.quantity,
            row.value,
          ]),
        ],
      ),
    )
    snackbar.success(`Exported ${orders.length + centres.length} rows`, filename)
  }

  const loading = committed.isLoading || received.isLoading
  const empty = !loading && orders.length === 0 && centres.length === 0

  return (
    <AppShell title="Procurement Costs">
      <Link className="page-back" to="/reports">
        <ArrowLeft size={14} aria-hidden />
        All reports
      </Link>

      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Procurement Costs</h1>
          <p className="page-head__subtitle">
            What was committed to the Tailoring Centers, and what actually
            arrived. Everything is priced at the day it was agreed, never at
            today&rsquo;s price list.
          </p>
        </div>

        <ExportControls onExportCsv={exportCsv} disabled={loading || empty} />
      </header>

      <div className="filter-bar">
        <label className="filter-bar__field">
          <span>From:</span>
          <input
            type="date"
            aria-label="Period start"
            value={period.from}
            onChange={(event) => setPeriod((p) => ({ ...p, from: event.target.value }))}
          />
        </label>

        <label className="filter-bar__field">
          <span>To:</span>
          <input
            type="date"
            aria-label="Period end"
            value={period.to}
            onChange={(event) => setPeriod((p) => ({ ...p, to: event.target.value }))}
          />
        </label>

        <label className="filter-bar__field filter-bar__field--check">
          <input
            type="checkbox"
            checked={includeCancelled}
            onChange={(event) => setIncludeCancelled(event.target.checked)}
          />
          <span>Include cancelled orders</span>
        </label>
      </div>

      {committed.isError && (
        <Alert tone="error">
          The committed figures could not be loaded, so nothing below adds up
          to a total. Try again in a moment.
        </Alert>
      )}
      {received.isError && (
        <Alert tone="error">
          The received figures could not be loaded. The committed side below is
          still correct on its own.
        </Alert>
      )}

      {/*
        The two totals, side by side and never subtracted — see the header
        comment. They measure different things over the same period, not two
        ends of one balance.
      */}
      {!loading && !empty && totals && (
        <div className="kpi-row">
          <div className="kpi">
            <p className="kpi__figure">
              <Coins size={18} aria-hidden className="kpi__icon" />
              <span className="kpi__value t-numeric">{formatUGX(totals.value)}</span>
            </p>
            <p className="kpi__caption">
              {formatQuantity(totals.quantity)} units on {totals.orders}{' '}
              {totals.orders === 1 ? 'order' : 'orders'}
            </p>
            <p className="kpi__label">Committed to the TCs</p>
          </div>

          <div className="kpi">
            <p className="kpi__figure">
              <PackageCheck size={18} aria-hidden className="kpi__icon" />
              <span className="kpi__value t-numeric">
                {formatUGX(receivedValue.toFixed(2))}
              </span>
            </p>
            <p className="kpi__caption">
              {formatQuantity(receivedUnits)} units counted in
            </p>
            <p className="kpi__label">Received</p>
          </div>

        </div>
      )}

      {loading ? (
        <SkeletonRows rows={8} />
      ) : empty ? (
        <EmptyState
          title="Nothing in this period"
          body="No group order was raised and no delivery was received between these dates. Widen the period, or clear both bounds to see everything."
          icon={Coins}
        />
      ) : (
        <div className="reports__stack">
          <div className="table-card">
            <header className="table-card__head">
              <h2 className="table-card__title">Committed — group orders</h2>
            </header>
            <div className="table-scroll">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Raised</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th className="ledger__num">Lines</th>
                    <th className="ledger__num">Units</th>
                    <th className="ledger__num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((row) => (
                    <tr key={row.number}>
                      <td className="ledger__code">{row.number}</td>
                      <td className="ledger__nowrap">{formatDay(row.order_date)}</td>
                      <td className="ledger__nowrap">
                        {row.due_in_warehouse_date
                          ? formatDay(row.due_in_warehouse_date)
                          : '—'}
                      </td>
                      <td className="ledger__nowrap">{row.status}</td>
                      <td className="ledger__num t-numeric">{row.line_count}</td>
                      <td className="ledger__num t-numeric">
                        {formatQuantity(row.quantity)}
                      </td>
                      <td className="ledger__num t-numeric">{formatUGX(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {orders.length === 0 && (
              <p className="panel__clear">No group order was raised in this period.</p>
            )}
          </div>

          <div className="table-card">
            <header className="table-card__head">
              <h2 className="table-card__title">Received — by Tailoring Center</h2>
            </header>
            <div className="table-scroll">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Tailoring Center</th>
                    <th className="ledger__num">Receipts</th>
                    <th className="ledger__num">Units counted</th>
                    <th className="ledger__num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {centres.map((row) => (
                    <tr key={row.tailoring_center_id}>
                      <td className="ledger__wrap">{row.tailoring_center_name}</td>
                      <td className="ledger__num t-numeric">{row.receipts}</td>
                      <td className="ledger__num t-numeric">
                        {formatQuantity(row.quantity)}
                      </td>
                      <td className="ledger__num t-numeric">{formatUGX(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {centres.length === 0 && (
              <p className="panel__clear">Nothing was received in this period.</p>
            )}
            <div className="table-card__footer">
              <p className="table-card__note">
                Valued at what was counted in, not at what the order asked for —
                a short delivery is worth less.
              </p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
