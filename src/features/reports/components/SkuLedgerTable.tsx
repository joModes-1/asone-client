/**
 * Detailed SKU Ledger Breakdown — Figma 58:3595 `table-card`.
 *
 * A column per warehouse, generated from the data rather than hardcoded, so
 * the header always matches what is in the rows. The design names Namayemba
 * and Serere; a third warehouse would appear on its own without a change
 * here.
 *
 * The table scrolls inside its own container so a wide set of warehouses
 * never makes the page scroll sideways. Quantities are tabular so the
 * columns line up, which is most of what makes a stock table readable.
 *
 * Paged at the design's ten rows rather than scrolled. A full catalogue is
 * hundreds of SKUs, and a panel that grows to hold all of them pushes
 * everything else off the screen — the point of a report page is that the
 * figures above stay in view.
 */

import { Pagination, Panel } from '@/components'
import { formatCompactUGX, formatQuantity } from '@/domain/money'
import type { LedgerRow, WarehouseColumn } from '../pivot'
import { LIST_PAGE_SIZE } from '@/api/pageSize'

/** The design shows ten rows; a report page should not scroll to be read. */
const PAGE_SIZE = LIST_PAGE_SIZE

interface SkuLedgerTableProps {
  rows: LedgerRow[]
  columns: WarehouseColumn[]
  loading: boolean
  /** Total before the SKU filter, so the count can say what was narrowed. */
  totalRows: number
  page: number
  onPageChange: (page: number) => void
}

export function SkuLedgerTable({
  rows,
  columns,
  loading,
  totalRows,
  page,
  onPageChange,
}: SkuLedgerTableProps) {
  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1)
  // A filter can shrink the set under the current page; clamp rather than
  // show an empty page and leave someone wondering where the rows went.
  const safePage = Math.min(page, pageCount)
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <Panel
      title="Detailed SKU Ledger Breakdown"
      tone="sunken"
      busy={loading}
      meta={
        !loading ? (
          <span className="panel__meta">
            {rows.length === totalRows
              ? `${formatQuantity(rows.length)} SKUs`
              : `${formatQuantity(rows.length)} of ${formatQuantity(totalRows)} SKUs`}
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <div className="skeleton-stack" aria-hidden>
          <span className="skeleton" style={{ height: 40 }} />
          <span className="skeleton" style={{ height: 40 }} />
          <span className="skeleton" style={{ height: 40 }} />
        </div>
      ) : rows.length === 0 ? (
        <p className="panel__clear">No SKUs match this filter.</p>
      ) : (
        <div className="table-scroll">
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Garment Description</th>
                {columns.map((column) => (
                  <th scope="col" className="ledger__num" key={column.id}>
                    {column.name} Qty
                  </th>
                ))}
                <th scope="col" className="ledger__num">
                  Total Stock
                </th>
                <th scope="col" className="ledger__num">
                  Estimated Value
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.skuId}>
                  <td className="ledger__code">{row.skuNumber}</td>
                  <td>{row.description}</td>
                  {columns.map((column) => (
                    <td className="ledger__num" key={column.id}>
                      {formatQuantity(row.byWarehouse.get(column.id) ?? 0)}
                    </td>
                  ))}
                  <td className="ledger__num ledger__total">
                    {formatQuantity(row.totalUnits)}
                  </td>
                  <td className="ledger__num">{formatCompactUGX(row.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          totalItems={rows.length}
          pageSize={PAGE_SIZE}
          onChange={onPageChange}
          noun="SKUs"
        />
      )}
    </Panel>
  )
}
