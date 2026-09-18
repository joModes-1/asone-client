/**
 * Inventory Overview's table — one row per SKU per warehouse.
 *
 * Paginated on the client, like the stock report's `SkuLedgerTable`: every
 * row for the current filters is already in memory (the catalogue is capped
 * at 200 SKUs — see `useInventoryRows`), so slicing locally is simpler than
 * a second round of server paging over a set this small.
 *
 * The whole row opens the SKU's detail panel, not just one cell — same
 * reasoning as the Schools table (see `SchoolsTable.tsx`): a list of things
 * to inspect shouldn't make you hunt for the one clickable cell.
 */

import { Boxes } from 'lucide-react'
import { Badge, EmptyState, Pagination } from '@/components'
import { formatCompactUGX, formatQuantity } from '@/domain/money'
import type { InventoryRow } from '../hooks/useInventoryRows'

const PAGE_SIZE = 12

interface InventoryTableProps {
  rows: InventoryRow[]
  loading: boolean
  page: number
  onPageChange: (page: number) => void
  onSelectRow: (row: InventoryRow) => void
  selectedSkuId: number | null
  onCreate: () => void
  isCompact?: boolean
}

export function InventoryTable({
  rows,
  loading,
  page,
  onPageChange,
  onSelectRow,
  selectedSkuId,
  onCreate,
  isCompact = false,
}: InventoryTableProps) {
  if (loading) {
    return (
      <div className="skeleton-stack" aria-hidden>
        <span className="skeleton" style={{ height: 40 }} />
        <span className="skeleton" style={{ height: 40 }} />
        <span className="skeleton" style={{ height: 40 }} />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title="No SKUs match this filter"
        body="Try a different level, size, or status — or create the first SKU for this filter."
        action={{ label: '+ Create New SKU', onClick: onCreate }}
      />
    )
  }

  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1)
  const safePage = Math.min(page, pageCount)
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <>
      <div className="inventory-table-card">
        {/* `ledger` carries the typography every other table in the app
            uses; `inventory-table` adds only what is this table's own. */}
        <table
          className={`ledger ledger--clickable inventory-table${
            isCompact ? ' inventory-table--compact' : ''
          }`}
        >
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col">Garment</th>
              <th scope="col">Description</th>
              <th scope="col">Level</th>
              <th scope="col">Size</th>
              <th scope="col">Color</th>
              {!isCompact && (
                <>
                  <th scope="col">Warehouse</th>
                  <th scope="col" className="inventory-table__th-num">
                    Available
                  </th>
                  <th scope="col" className="inventory-table__th-num">
                    Pick
                  </th>
                  <th scope="col" className="inventory-table__th-num">
                    Shipped
                  </th>
                  <th scope="col" className="inventory-table__th-num">
                    Min. Stock
                  </th>
                  <th scope="col" className="inventory-table__th-num">
                    Value
                  </th>
                  <th scope="col">Status</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const rowKey = `${row.skuId}-${row.warehouseId}`
              const low = row.minimumQuantity !== null && row.available <= row.minimumQuantity
              const isSelected = row.skuId === selectedSkuId
              return (
                <tr
                  key={rowKey}
                  className={`inventory-table__row--clickable ${
                    isSelected ? 'inventory-table__row--selected' : ''
                  }`}
                  onClick={() => onSelectRow(row)}
                >
                  {/*
                    `ledger__link`, the same as an Order ID in the orders
                    table — a row here opens the SKU beside the table, so the
                    cell that names it should carry the same affordance. Not
                    an anchor, because the panel is not a route and there is
                    no URL to hand a middle-click.
                  */}
                  <td
                    className={`ledger__link inventory-table__td-code${
                      isSelected ? ' inventory-table__td-code--selected' : ''
                    }`}
                  >
                    {row.skuNumber}
                  </td>
                  <td className="inventory-table__td-name ledger__wrap" title={row.garmentName}>
                    {row.garmentName}
                  </td>
                  <td className="inventory-table__td-muted ledger__wrap" title={row.description}>
                    {row.description}
                  </td>
                  <td>{row.level}</td>
                  <td>{row.sizeName}</td>
                  <td className="inventory-table__td-muted">{row.colour || '—'}</td>
                  {!isCompact && (
                    <>
                      <td className="inventory-table__td-muted">{row.warehouseName}</td>
                      <td
                        className={`inventory-table__td-num ${low ? 'inventory-table__td-low' : ''}`}
                      >
                        {formatQuantity(row.available)}
                      </td>
                      <td className="inventory-table__td-num">{formatQuantity(row.pick)}</td>
                      <td className="inventory-table__td-num">{formatQuantity(row.shipped)}</td>
                      <td className="inventory-table__td-num">
                        {formatQuantity(row.minimumQuantity)}
                      </td>
                      <td className="inventory-table__td-num">{formatCompactUGX(row.value)}</td>
                      <td>
                        <Badge tone={row.isActive ? 'success' : 'error'}>
                          {row.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={safePage}
        pageCount={pageCount}
        totalItems={rows.length}
        pageSize={PAGE_SIZE}
        onChange={onPageChange}
        noun="SKUs"
      />
    </>
  )
}
