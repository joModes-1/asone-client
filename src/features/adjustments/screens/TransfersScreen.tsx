/**
 * Warehouse Transfers — F25.
 *
 * Stock moving between sites. **No money moves**: AsOne owns it either side,
 * so a transfer changes where stock is, not what it is worth, and posting
 * writes two ledger rows at the same unit value rather than one.
 *
 * The one place on these screens where the leads are not locked out — F25
 * gives transfers to Program Lead and Operations Manager as well as Finance,
 * where every neighbouring feature is Finance alone. That is why this is its
 * own tab and its own route rather than a fifth kind of adjustment.
 *
 * ---------------------------------------------------------------------------
 * Two statuses, not five
 * ---------------------------------------------------------------------------
 * The design draws REQUESTED · APPROVED · IN TRANSIT · RECEIVED · COMPLETED,
 * and three cards counting them. The server has no approval step and no
 * in-transit state: a transfer is either **prepared**, having moved nothing,
 * or **posted**, both halves written. Drawing the other three would be five
 * labels over two facts, and an approval queue that approves nothing.
 *
 * Flagged for AsOne rather than invented — if they want sign-off before
 * stock moves, that is a real change to F25 and open question Q10, not a
 * column on this table.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Plus } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Pagination,
  SkeletonRows,
  TabBar,
} from '@/components'
import { daysAgoISO, formatDay } from '@/domain/dates'
import { formatQuantity } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { TransferDetailModal } from '../components/TransferDetailModal'
import { DATE_RANGES } from '../dateRanges'
import { TRANSFERS_PAGE_SIZE, useTransfers } from '../hooks/useAdjustments'

export function TransfersScreen() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [days, setDays] = useState<number | null>(30)
  /* By id, not by row: the list refetches once a draft is posted, and a held
     object would keep showing the state it was in before. */
  const [openId, setOpenId] = useState<number | null>(null)

  const since = days === null ? null : daysAgoISO(days)
  const transfers = useTransfers(page, since)

  const rows = transfers.data?.results ?? []
  const total = transfers.data?.count ?? 0
  const drafts = rows.filter((row) => !row.is_posted).length
  const open = rows.find((row) => row.id === openId) ?? null

  return (
    <AppShell title="Warehouse Transfers" searchHint="transfer or SKU">
      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Warehouse Transfers</h1>
          <p className="page-head__subtitle">
            Stock moving between warehouses. Nothing is bought or sold, so total
            inventory value is the same before and after.
          </p>
        </div>

        <Button onClick={() => navigate('/transfers/new')}>
          <Plus size={16} aria-hidden />
          New Transfer
        </Button>
      </header>

      <TabBar
        tabs={[
          { key: 'adjustments', label: 'Adjustments' },
          { key: 'transfers', label: 'Warehouse Transfers' },
        ]}
        active="transfers"
        onSelect={(key) => {
          if (key === 'adjustments') navigate('/adjustments')
        }}
        label="Adjustment views"
      />

      {transfers.isError && (
        <Alert tone="error">
          The transfer history could not be loaded, so this list is not a
          record of what has moved. Try again in a moment.
        </Alert>
      )}

      {/*
        A prepared transfer has moved nothing. Left unnoticed it reads on
        every other screen as stock that is still where it was — which is
        true, and is exactly the confusion worth naming.
      */}
      {drafts > 0 && (
        <Alert tone="warning">
          {drafts === 1
            ? 'One transfer on this page is prepared but not posted — nothing has moved yet. Open the row to post it.'
            : `${drafts} transfers on this page are prepared but not posted — nothing has moved yet. Open a row to post it.`}
        </Alert>
      )}

      <div className="filter-bar">
        <label className="filter-bar__field">
          <span>Date Range:</span>
          <select
            aria-label="Date range"
            value={days ?? ''}
            onChange={(event) => {
              setDays(event.target.value ? Number(event.target.value) : null)
              setPage(1)
            }}
          >
            {DATE_RANGES.map((range) => (
              <option key={range.label} value={range.days ?? ''}>
                {range.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-card">
        {transfers.isLoading ? (
          <SkeletonRows rows={8} />
        ) : rows.length === 0 && !transfers.isError ? (
          <EmptyState
            title={
              days === null
                ? 'Nothing has been transferred'
                : `Nothing transferred in the last ${days} days`
            }
            body="A transfer appears here when stock is rebalanced between warehouses — usually because one site is short of what another has spare."
            icon={ArrowLeftRight}
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="ledger ledger--transfers ledger--clickable">
                <thead>
                  <tr>
                    <th>Transfer #</th>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Destination</th>
                    <th>Items</th>
                    <th className="ledger__num">Qty</th>
                    <th>Raised By</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const units = row.lines.reduce((sum, line) => sum + line.quantity, 0)

                    return (
                      <tr key={row.id} onClick={() => setOpenId(row.id)}>
                        <td className="ledger__code">
                          <button
                            type="button"
                            className="ledger__link"
                            onClick={(event) => {
                              event.stopPropagation()
                              setOpenId(row.id)
                            }}
                          >
                            {row.number}
                          </button>
                        </td>
                        <td>{formatDay(row.transfer_date)}</td>
                        <td className="ledger__nowrap">{row.from_warehouse_name}</td>
                        <td className="ledger__nowrap">{row.to_warehouse_name}</td>
                        <td className="ledger__wrap">
                          {/* The SKUs themselves, not a count of them: "3
                              items" tells a reader nothing they can act on. */}
                          {row.lines.map((line) => line.sku_number).join(', ') || '—'}
                        </td>
                        <td className="ledger__num t-numeric">{formatQuantity(units)}</td>
                        <td className="ledger__nowrap">{row.created_by_name}</td>
                        <td>
                          <Badge tone={row.is_posted ? 'success' : 'warning'}>
                            {row.is_posted ? 'POSTED' : 'PREPARED'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="table-card__footer">
              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(total / TRANSFERS_PAGE_SIZE))}
                totalItems={total}
                pageSize={TRANSFERS_PAGE_SIZE}
                onChange={setPage}
                noun="transfers"
              />
            </div>
          </>
        )}
      </div>

      <TransferDetailModal transfer={open} onClose={() => setOpenId(null)} />
    </AppShell>
  )
}
