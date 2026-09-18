/**
 * Inventory Overview's filter bar.
 *
 * Same shape as `SchoolsFilterBar` — a plain white toolbar, each field its
 * own bordered pill. Level and Status are server-side (`?garment__school_level=`,
 * `?is_active=` on `/catalog/skus/`); Size likewise (`?size=`). Search and
 * Low Stock Only narrow only the rows already fetched — see
 * `useInventoryRows` for why "low stock" is computed from the same minimum
 * and available figures the table shows, not a separate call.
 *
 * Warehouse here is a view onto the shell's own top-bar filter
 * (`useWarehouseFilter`), not a second, independent selector — the same
 * `warehouseId`/`options`/`select` the top bar itself uses are just passed
 * through as props, so choosing a site here changes the exact same value
 * the top bar shows, rather than a local copy that could disagree with it.
 * That matters because stock is scoped by warehouse everywhere else in the
 * app too (Reports, Dashboard) — this is one more place to read or set the
 * one warehouse selection that already exists, not a competing one.
 *
 * Export CSV and + Create New SKU live in the page header, not here — the
 * reference design puts them beside the title, not in the filter row.
 */

import { ChevronDown, Search } from 'lucide-react'
import type { GarmentSchoolLevel, Size, Warehouse } from '@/api/types'

interface InventoryFilterBarProps {
  query: string
  onQueryChange: (value: string) => void
  level: GarmentSchoolLevel | null
  onLevelChange: (value: GarmentSchoolLevel | null) => void
  sizeId: number | null
  onSizeChange: (value: number | null) => void
  isActive: boolean | null
  onIsActiveChange: (value: boolean | null) => void
  lowStockOnly: boolean
  onLowStockOnlyChange: (value: boolean) => void
  sizes: Size[]
  isCompact?: boolean
  warehouseId?: number | null
  warehouses?: Warehouse[]
  onWarehouseChange?: (id: number | null) => void
}

const ALL = 'all'

export function InventoryFilterBar({
  query,
  onQueryChange,
  level,
  onLevelChange,
  sizeId,
  onSizeChange,
  isActive,
  onIsActiveChange,
  lowStockOnly,
  onLowStockOnlyChange,
  sizes,
  isCompact = false,
  warehouseId,
  warehouses = [],
  onWarehouseChange,
}: InventoryFilterBarProps) {
  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId)
  const warehouseDisplay = selectedWarehouse ? selectedWarehouse.name : 'All'

  const levelDisplay =
    level === 'PS' ? 'Primary (PS)' : level === 'HS' ? 'High School (HS)' : 'All'

  const selectedSize = sizes.find((s) => s.id === sizeId)
  const sizeDisplay = selectedSize ? selectedSize.name : 'All Sizes'

  const statusDisplay =
    isActive === null ? 'All Statuses' : isActive ? 'Active' : 'Inactive'

  if (isCompact) {
    return (
      <div className="inventory-filter-card inventory-filter-card--compact">
        <div className="inventory-filter__search inventory-filter__search--compact">
          <Search size={15} className="inventory-filter__search-icon" aria-hidden />
          <input
            type="search"
            placeholder="Search SKU..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>

        {warehouses.length > 0 && (
          <div className="inventory-filter__pill">
            <span className="inventory-filter__pill-label">Warehouse:</span>
            <span className="inventory-filter__pill-value">{warehouseDisplay}</span>
            <ChevronDown size={14} className="inventory-filter__chevron" aria-hidden />
            <select
              aria-label="Warehouse"
              value={warehouseId ?? ALL}
              onChange={(event) => {
                const next = event.target.value
                onWarehouseChange?.(next === ALL ? null : Number(next))
              }}
              className="inventory-filter__pill-select"
            >
              <option value={ALL}>All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="inventory-filter-card">
      <div className="inventory-filter__search">
        <Search size={15} className="inventory-filter__search-icon" aria-hidden />
        <input
          type="search"
          placeholder="Search SKU, gar..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      {warehouses.length > 0 && (
        <div className="inventory-filter__pill">
          <span className="inventory-filter__pill-label">Warehouse:</span>
          <span className="inventory-filter__pill-value">{warehouseDisplay}</span>
          <ChevronDown size={14} className="inventory-filter__chevron" aria-hidden />
          <select
            aria-label="Warehouse"
            value={warehouseId ?? ALL}
            onChange={(event) => {
              const next = event.target.value
              onWarehouseChange?.(next === ALL ? null : Number(next))
            }}
            className="inventory-filter__pill-select"
          >
            <option value={ALL}>Warehouse: All</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="inventory-filter__pill">
        <span className="inventory-filter__pill-label">Level:</span>
        <span className="inventory-filter__pill-value">{levelDisplay}</span>
        <ChevronDown size={14} className="inventory-filter__chevron" aria-hidden />
        <select
          aria-label="School level"
          value={level ?? ALL}
          onChange={(event) => {
            const next = event.target.value
            onLevelChange(next === ALL ? null : (next as GarmentSchoolLevel))
          }}
          className="inventory-filter__pill-select"
        >
          <option value={ALL}>All</option>
          <option value="PS">Primary (PS)</option>
          <option value="HS">High School (HS)</option>
        </select>
      </div>

      <div className="inventory-filter__pill">
        <span className="inventory-filter__pill-label">Size:</span>
        <span className="inventory-filter__pill-value">{sizeDisplay}</span>
        <ChevronDown size={14} className="inventory-filter__chevron" aria-hidden />
        <select
          aria-label="Size"
          value={sizeId === null ? ALL : String(sizeId)}
          onChange={(event) => {
            const next = event.target.value
            onSizeChange(next === ALL ? null : Number(next))
          }}
          className="inventory-filter__pill-select"
        >
          <option value={ALL}>All Sizes</option>
          {sizes.map((size) => (
            <option key={size.id} value={size.id}>
              {size.name}
            </option>
          ))}
        </select>
      </div>

      <div className="inventory-filter__pill">
        <span className="inventory-filter__pill-label">Status:</span>
        <span className="inventory-filter__pill-value">{statusDisplay}</span>
        <ChevronDown size={14} className="inventory-filter__chevron" aria-hidden />
        <select
          aria-label="Status"
          value={isActive === null ? ALL : isActive ? 'active' : 'inactive'}
          onChange={(event) => {
            const next = event.target.value
            onIsActiveChange(next === ALL ? null : next === 'active')
          }}
          className="inventory-filter__pill-select"
        >
          <option value={ALL}>All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="inventory-filter__divider" aria-hidden />

      <label className="inventory-filter__toggle">
        <input
          type="checkbox"
          checked={lowStockOnly}
          onChange={(event) => onLowStockOnlyChange(event.target.checked)}
        />
        <span className="inventory-filter__toggle-track" aria-hidden />
        <span className="inventory-filter__toggle-text">Low Stock Only</span>
      </label>
    </div>
  )
}
