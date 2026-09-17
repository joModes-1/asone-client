/**
 * Inventory Adjustments — F23, F24, F26, F27.
 *
 * The history of every stock figure that changed without a physical event
 * behind it. A receipt, a pick and a shipment all have a document and a
 * person on the other end; these have only a judgement — the count was
 * wrong, the goods came back, the goods were ruined — and a reason code
 * saying which.
 *
 * Which is why this screen exists at all. AsOne's matrix gives the column to
 * Finance alone (open question Q3: the warehouse does the counting but
 * cannot post the result), so the audit trail is the only thing standing
 * between an adjustment and nobody knowing it happened.
 *
 * **Nothing here is editable and nothing is deleted.** A wrong adjustment is
 * corrected by posting an offsetting one — F28 — which is why there is no
 * row action and no bin icon.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, SlidersHorizontal } from 'lucide-react'
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
import {
  formatSigned,
  kindOfCode,
  signedQuantity,
  typeLabel,
  typeTone,
} from '@/domain/adjustments'
import { AppShell } from '@/features/shell/components/AppShell'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { AdjustmentDetailModal } from '../components/AdjustmentDetailModal'
import { AdjustmentFilterBar, type AdjustmentFilterValue } from '../components/AdjustmentFilterBar'
import {
  ADJUSTMENTS_PAGE_SIZE,
  useAdjustments,
  useReasonCodes,
} from '../hooks/useAdjustments'

// Opens on the last 30 days, as drawn. An audit trail that opens on
// everything ever posted buries this month under two years of history.
const NO_FILTERS: AdjustmentFilterValue = { search: '', kind: null, days: 30 }

export function AdjustmentsScreen() {
  const navigate = useNavigate()
  const { warehouseId, options, canSwitch, select } = useWarehouseFilter()

  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<AdjustmentFilterValue>(NO_FILTERS)
  /* Held by id, not by row: the list refetches after a draft is posted, and
     a held object would keep showing the state it was in before. */
  const [openId, setOpenId] = useState<number | null>(null)

  const since = filters.days === null ? null : daysAgoISO(filters.days)
  const adjustments = useAdjustments(page, warehouseId, since)
  const reasonCodes = useReasonCodes()

  const codes = useMemo(() => reasonCodes.data?.results ?? [], [reasonCodes.data])
  const rows = useMemo(() => adjustments.data?.results ?? [], [adjustments.data])
  const total = adjustments.data?.count ?? 0

  const visible = useMemo(() => {
    const needle = filters.search.trim().toLowerCase()

    return rows.filter((row) => {
      if (filters.kind && kindOfCode(row.reason_code_code) !== filters.kind) return false
      if (!needle) return true
      return (
        row.number.toLowerCase().includes(needle) ||
        row.sku_number.toLowerCase().includes(needle) ||
        row.sku_description.toLowerCase().includes(needle) ||
        row.created_by_name.toLowerCase().includes(needle)
      )
    })
  }, [rows, filters])

  const narrowed = visible.length !== rows.length
  const open = rows.find((row) => row.id === openId) ?? null

  return (
    <AppShell title="Inventory Adjustments" searchHint="SKU or reason">
      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Inventory Adjustments</h1>
          <p className="page-head__subtitle">
            Track and log warehouse adjustments, stock corrections, and damage claims.
          </p>
        </div>

        <Button onClick={() => navigate('/adjustments/new')}>
          <Plus size={16} aria-hidden />
          New Adjustment
        </Button>
      </header>

      <TabBar
        tabs={[
          { key: 'adjustments', label: 'Adjustments' },
          { key: 'transfers', label: 'Warehouse Transfers' },
        ]}
        active="adjustments"
        onSelect={(key) => {
          if (key === 'transfers') navigate('/transfers')
        }}
        label="Adjustment views"
      />

      {/*
        A failed query renders as an empty table, which on this screen would
        read as "nothing has ever been adjusted" — the most reassuring
        possible lie for an audit trail.
      */}
      {adjustments.isError && (
        <Alert tone="error">
          The adjustment history could not be loaded, so this list is not a
          record of what has been posted. Try again in a moment.
        </Alert>
      )}

      {/*
        Without the codes table a quantity has no direction, and a "−5"
        printed where it should read "+5" is the one mistake this screen must
        not make. So it says so rather than guessing.
      */}
      {reasonCodes.isError && (
        <Alert tone="warning">
          The reason codes could not be loaded, so quantities below are shown
          without a direction. Reload before reading them as gains or losses.
        </Alert>
      )}

      <AdjustmentFilterBar
        value={filters}
        onChange={(next) => {
          // A narrower range can leave the current page past the end of the
          // result set, which renders as an empty table nobody asked for.
          if (next.days !== filters.days) setPage(1)
          setFilters(next)
        }}
        warehouses={options}
        warehouseId={warehouseId}
        onWarehouseChange={(id) => {
          select(id)
          setPage(1)
        }}
        canSwitchWarehouse={canSwitch}
      />

      <div className="table-card">
        {adjustments.isLoading ? (
          <SkeletonRows rows={8} />
        ) : rows.length === 0 && !adjustments.isError ? (
          <EmptyState
            title={
              filters.days === null
                ? 'Nothing has been adjusted'
                : `Nothing adjusted in the last ${filters.days} days`
            }
            body="An adjustment appears here when Finance corrects a count, takes a return back into stock, or writes off damaged goods."
            icon={SlidersHorizontal}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="Nothing on this page matches"
            body="Search and type narrow the page you are looking at, not all of the history. Clear them, or try another page."
            icon={SlidersHorizontal}
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="ledger ledger--adjustments ledger--clickable">
                <thead>
                  <tr>
                    <th>Adj #</th>
                    <th>Date</th>
                    <th>Warehouse</th>
                    <th>SKU</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th className="ledger__num">Qty</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const signed = signedQuantity(row.quantity, row.reason_code_code, codes)

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setOpenId(row.id)}
                        /* The whole row opens it for a mouse; the number is a
                           real button so a keyboard reaches it too. */
                      >
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
                        <td>{formatDay(row.adjustment_date)}</td>
                        <td className="ledger__nowrap">{row.warehouse_name}</td>
                        <td className="ledger__code">{row.sku_number}</td>
                        <td className="ledger__wrap">{row.sku_description}</td>
                        <td>
                          <Badge tone={typeTone(row.reason_code_code)}>
                            {typeLabel(row.reason_code_code)}
                          </Badge>
                          {/* A draft moved no stock. Marked beside the type
                              rather than in a column of its own, which would
                              be empty on almost every row. */}
                          {!row.is_posted && <Badge tone="warning">DRAFT</Badge>}
                        </td>
                        <td
                          className={`ledger__num t-numeric${
                            signed === null
                              ? ''
                              : signed < 0
                                ? ' ledger__num--owed'
                                : ' ledger__num--gain'
                          }`}
                        >
                          {signed === null ? row.quantity : formatSigned(signed)}
                        </td>
                        <td className="ledger__reason">
                          {/*
                            The note, not the reason code's name. There is one
                            active code per family today, so printing the name
                            here just restates the Type badge two columns
                            along — "DAMAGED · Damaged". What a reader wants
                            from this column is what actually happened.

                            The name is the fallback when nobody wrote a note,
                            because then it is all the row records; and it is
                            always in the row dialog, with its code.
                          */}
                          {row.notes?.trim() ? (
                            <span className="ledger__reason-text">{row.notes}</span>
                          ) : (
                            <span className="ledger__reason-text ledger__reason--fallback">
                              {row.reason_code_name}
                            </span>
                          )}
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
                pageCount={Math.max(1, Math.ceil(total / ADJUSTMENTS_PAGE_SIZE))}
                totalItems={total}
                pageSize={ADJUSTMENTS_PAGE_SIZE}
                onChange={setPage}
                noun="adjustments"
              />
              {narrowed && (
                <p className="table-card__note">
                  Showing {visible.length} of {rows.length} on this page. Search and type
                  narrow the page, not the whole history.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <AdjustmentDetailModal
        adjustment={open}
        codes={codes}
        onClose={() => setOpenId(null)}
      />
    </AppShell>
  )
}
