/**
 * Stock History — F48, the audit trail.
 *
 * The ledger itself: every movement of every SKU, newest first, with the
 * document that caused it and the person who posted it.
 *
 * ---------------------------------------------------------------------------
 * Why this screen is not the adjustments screen
 * ---------------------------------------------------------------------------
 * Adjustments are the movements with *no physical event* behind them — a
 * judgement that the count was wrong, that goods came back, that goods were
 * ruined. This is all eight movement types, including the six that do have a
 * document on the other end: receipts, picks, shipments, transfers.
 *
 * So the two answer different questions. "What did Finance change, and why"
 * is the adjustments screen. "Where did these 640 units go" is this one, and
 * it is the only screen that can answer it, because an adjustment is the one
 * kind of row it would not show.
 *
 * ---------------------------------------------------------------------------
 * Nothing here is editable, and that is enforced below this screen
 * ---------------------------------------------------------------------------
 * `StockMovement` refuses to be updated or deleted at model level, and the
 * viewset is read-only — not by omission but on purpose. A stock figure is
 * summed from these rows on every read, so an edited ledger row would
 * silently restate history *and* change today's stock. A wrong movement is
 * corrected by posting an offsetting one.
 *
 * Which is why there is no row action, no bin icon, and no detail dialogue
 * that could be mistaken for a form.
 */

import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { Alert, Badge, EmptyState, Pagination, SkeletonRows } from '@/components'
import { daysAgoISO, formatDay } from '@/domain/dates'
import { documentKind, movementLabel, stockStatusLabel } from '@/domain/ledger'
import { formatSignedQuantity, formatUGX } from '@/domain/money'
import { movementTone } from '@/domain/status'
import { useSkuOptions } from '@/features/catalog/hooks/useSkuOptions'
import { AppShell } from '@/features/shell/components/AppShell'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import {
  StockHistoryFilterBar,
  type StockHistoryFilterValue,
} from '../components/StockHistoryFilterBar'
import { STOCK_HISTORY_PAGE_SIZE, useStockHistory } from '../hooks/useStockHistory'

/*
 * Opens on the last 30 days, like the adjustments trail. The ledger holds
 * every movement since the system was switched on, and opening on all of it
 * buries this month under a year of receipts.
 */
const NO_FILTERS: StockHistoryFilterValue = { skuId: null, movementType: null, days: 30 }

export function StockHistoryScreen() {
  const { warehouseId, options, canSwitch, select } = useWarehouseFilter()

  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<StockHistoryFilterValue>(NO_FILTERS)

  const since = filters.days === null ? null : daysAgoISO(filters.days)
  const history = useStockHistory(page, {
    warehouseId,
    skuId: filters.skuId,
    movementType: filters.movementType,
    since,
  })
  const skusQuery = useSkuOptions()

  const skus = useMemo(() => skusQuery.data?.results ?? [], [skusQuery.data])
  const rows = useMemo(() => history.data?.results ?? [], [history.data])
  const total = history.data?.count ?? 0

  /* Any change to a filter can leave the current page past the end of the
     new result set, which renders as an empty table nobody asked for. */
  function narrow(next: StockHistoryFilterValue) {
    setPage(1)
    setFilters(next)
  }

  return (
    <AppShell title="Stock History">
      <header className="page-head">
        <h1 className="page-head__title">Stock History</h1>
        <p className="page-head__subtitle">
          Every movement in and out of the warehouses, with the document and the
          person behind it. Nothing here can be edited or removed.
        </p>
      </header>

      {/*
        A failed query renders as an empty table, which on this screen would
        read as "nothing has ever moved" — the most reassuring possible lie
        for an audit trail.
      */}
      {history.isError && (
        <Alert tone="error">
          The stock history could not be loaded, so this list is not a record of
          what has moved. Try again in a moment.
        </Alert>
      )}

      {/*
        Without the SKU list the picker is empty, so the one filter this
        screen exists for cannot be set. The table is still correct.
      */}
      {skusQuery.isError && (
        <Alert tone="warning">
          The SKU list could not be loaded, so you cannot narrow to one product.
          Everything else on this page still works.
        </Alert>
      )}

      <StockHistoryFilterBar
        value={filters}
        onChange={narrow}
        skus={skus}
        warehouses={options}
        warehouseId={warehouseId}
        onWarehouseChange={(id) => {
          select(id)
          setPage(1)
        }}
        canSwitchWarehouse={canSwitch}
      />

      <div className="table-card">
        {history.isLoading ? (
          <SkeletonRows rows={8} />
        ) : rows.length === 0 && !history.isError ? (
          <EmptyState
            title="Nothing moved in this period"
            /* Says which filters produced the empty answer. On an audit
               trail "no rows" is a claim, and the reader has to be able to
               tell a quiet month from a filter set too narrowly. */
            body={
              filters.days === null
                ? 'No movement matches these filters. Widen the SKU or movement type to see more.'
                : `No movement in the last ${filters.days} days matches these filters. Try a longer date range.`
            }
            icon={History}
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="ledger ledger--history">
                <thead>
                  <tr>
                    <th>Txn #</th>
                    <th>Date</th>
                    <th>SKU</th>
                    <th>Description</th>
                    <th>Warehouse</th>
                    <th>Movement</th>
                    <th>Stock</th>
                    <th className="ledger__num">Qty</th>
                    <th className="ledger__num">Value</th>
                    <th>Document</th>
                    <th>Posted by</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const kind = documentKind(row.document_number)

                    return (
                      <tr key={row.id}>
                        <td className="ledger__code">{row.number}</td>
                        <td className="ledger__nowrap">{formatDay(row.occurred_on)}</td>
                        <td className="ledger__code">{row.sku_number}</td>
                        <td className="ledger__wrap">{row.sku_description}</td>
                        <td className="ledger__nowrap">{row.warehouse_name}</td>
                        <td>
                          <Badge tone={movementTone(row.movement_type)}>
                            {/* The same word the filter above offers — see
                                domain/ledger.ts for why not the server's
                                `movement_type_display`. */}
                            {movementLabel(row.movement_type)}
                          </Badge>
                        </td>
                        {/*
                          Which pot the units landed in, and the column that
                          stops a pick reading as a contradiction: one picks
                          posts −544 out of Available and +544 into Reserved
                          at the same warehouse on the same day.
                        */}
                        <td className="ledger__nowrap ledger__muted">
                          {stockStatusLabel(row.stock_status)}
                        </td>
                        <td
                          className={`ledger__num t-numeric${
                            row.quantity < 0 ? ' ledger__num--owed' : ' ledger__num--gain'
                          }`}
                        >
                          {formatSignedQuantity(row.quantity)}
                        </td>
                        {/* Unsigned: the value of what moved, not a gain or a
                            loss. A pick removes 20 units from this warehouse
                            and they are still worth what they were worth. */}
                        <td className="ledger__num t-numeric">{formatUGX(row.total_value)}</td>
                        <td className="ledger__nowrap">
                          {row.document_number}
                          {/* The prefix says what kind of document it is.
                              Shown as a quiet suffix rather than a column of
                              its own, which would repeat the movement type on
                              almost every row. */}
                          {kind && <span className="ledger__muted"> · {kind}</span>}
                        </td>
                        <td className="ledger__nowrap">{row.created_by_name}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="table-card__footer">
              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(total / STOCK_HISTORY_PAGE_SIZE))}
                totalItems={total}
                pageSize={STOCK_HISTORY_PAGE_SIZE}
                onChange={setPage}
                noun="movements"
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
