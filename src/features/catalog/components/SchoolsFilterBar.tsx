/**
 * The schools list's filter bar.
 *
 * Matches the Figma design exactly: a plain white toolbar, each field its
 * own bordered pill, no wrapping colour band. (An earlier pass wrongly
 * reused the reports screen's teal `.filters` band here instead of matching
 * this screen's own design — don't repeat that; a different screen's
 * pattern is not "consistency" when this screen has its own.)
 *
 * Type, Warehouse and Status are all real, server-side filters now
 * (`SchoolViewSet` supports `?level=`, `?primary_warehouse=` and, since
 * `School` gained an `is_active` field, `?is_active=`). Search narrows only
 * the page already on screen — see `useSchools` for why.
 */

import { ChevronDown, Search } from 'lucide-react'
import type { SchoolLevel, Warehouse } from '@/api/types'

interface SchoolsFilterBarProps {
  query: string
  onQueryChange: (value: string) => void
  level: SchoolLevel | null
  onLevelChange: (value: SchoolLevel | null) => void
  warehouseId: number | null
  onWarehouseChange: (value: number | null) => void
  isActive: boolean | null
  onIsActiveChange: (value: boolean | null) => void
  warehouses: Warehouse[]
}

const ALL = 'all'

export function SchoolsFilterBar({
  query,
  onQueryChange,
  level,
  onLevelChange,
  warehouseId,
  onWarehouseChange,
  isActive,
  onIsActiveChange,
  warehouses,
}: SchoolsFilterBarProps) {
  return (
    <div className="schools-filter-card">
      <div className="schools-filter__search">
        <Search size={16} className="schools-filter__search-icon" aria-hidden />
        <input
          type="search"
          placeholder="Search school name or address…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <div className="schools-filter__select-wrapper">
        <select
          aria-label="School type"
          value={level ?? ALL}
          onChange={(event) => {
            const next = event.target.value
            onLevelChange(next === ALL ? null : (next as SchoolLevel))
          }}
          className="schools-filter__select"
        >
          <option value={ALL}>Type: All</option>
          <option value="PS">Primary</option>
          <option value="HS">High School</option>
        </select>
        <ChevronDown size={14} className="schools-filter__chevron" aria-hidden />
      </div>

      <div className="schools-filter__select-wrapper">
        <select
          aria-label="Primary warehouse"
          value={warehouseId === null ? ALL : String(warehouseId)}
          onChange={(event) => {
            const next = event.target.value
            onWarehouseChange(next === ALL ? null : Number(next))
          }}
          className="schools-filter__select"
        >
          <option value={ALL}>Warehouse: All</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="schools-filter__chevron" aria-hidden />
      </div>

      <div className="schools-filter__select-wrapper">
        <select
          aria-label="Status"
          value={isActive === null ? ALL : isActive ? 'active' : 'inactive'}
          onChange={(event) => {
            const next = event.target.value
            onIsActiveChange(next === ALL ? null : next === 'active')
          }}
          className="schools-filter__select"
        >
          <option value={ALL}>Status: All</option>
          <option value="active">Status: Active</option>
          <option value="inactive">Status: Inactive</option>
        </select>
        <ChevronDown size={14} className="schools-filter__chevron" aria-hidden />
      </div>
    </div>
  )
}
