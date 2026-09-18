/**
 * The filter band above the stock history table.
 *
 * Same `.filter-bar` markup as adjustments, production orders and shipments —
 * one class system for this, not a fifth.
 *
 * **Every control here is applied by the server**, which is why there is no
 * free-text search box. The neighbouring screens have one and say plainly
 * that it narrows the page rather than the table; on an audit trail that
 * caveat is not good enough, because a search that quietly means "on this
 * page" turns "no rows" into a claim that nothing happened. The SKU picker
 * does the job a search box would have done here, and it does it against the
 * whole ledger.
 */

import { MOVEMENT_TYPES } from '@/domain/ledger'
import { DATE_RANGES } from '@/features/adjustments/dateRanges'
import type { MovementType, Sku, Warehouse } from '@/api/types'

export interface StockHistoryFilterValue {
  skuId: number | null
  movementType: MovementType | null
  /** Days back, or null for the whole ledger. */
  days: number | null
}

interface StockHistoryFilterBarProps {
  value: StockHistoryFilterValue
  onChange: (next: StockHistoryFilterValue) => void
  skus: Sku[]
  /** The warehouse picker, omitted for a role with no choice to make. */
  warehouses: Warehouse[]
  warehouseId: number | null
  onWarehouseChange: (id: number | null) => void
  canSwitchWarehouse: boolean
}

const ANY = ''

export function StockHistoryFilterBar({
  value,
  onChange,
  skus,
  warehouses,
  warehouseId,
  onWarehouseChange,
  canSwitchWarehouse,
}: StockHistoryFilterBarProps) {
  return (
    <div className="filter-bar">
      <label className="filter-bar__field">
        <span>SKU:</span>
        <select
          aria-label="SKU"
          value={value.skuId ?? ANY}
          onChange={(event) =>
            onChange({ ...value, skuId: event.target.value ? Number(event.target.value) : null })
          }
        >
          <option value={ANY}>All SKUs</option>
          {skus.map((sku) => (
            <option key={sku.id} value={sku.id}>
              {sku.number} — {sku.description}
            </option>
          ))}
        </select>
      </label>

      {canSwitchWarehouse && (
        <label className="filter-bar__field">
          <span>Warehouse:</span>
          <select
            aria-label="Warehouse"
            value={warehouseId ?? ANY}
            onChange={(event) =>
              onWarehouseChange(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value={ANY}>All</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="filter-bar__field">
        <span>Movement:</span>
        <select
          aria-label="Movement type"
          value={value.movementType ?? ANY}
          onChange={(event) =>
            onChange({
              ...value,
              movementType: (event.target.value || null) as MovementType | null,
            })
          }
        >
          <option value={ANY}>All movements</option>
          {MOVEMENT_TYPES.map((info) => (
            <option key={info.type} value={info.type}>
              {info.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-bar__field">
        <span>Date Range:</span>
        <select
          aria-label="Date range"
          value={value.days ?? ANY}
          onChange={(event) =>
            onChange({ ...value, days: event.target.value ? Number(event.target.value) : null })
          }
        >
          {DATE_RANGES.map((range) => (
            <option key={range.label} value={range.days ?? ANY}>
              {range.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
