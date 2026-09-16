/**
 * Inventory Overview — Inventory & Products.
 *
 * `requires: null` in `navigation.ts`: every role may read stock, scoped by
 * the shell's warehouse filter the same way Reports and Dashboard already
 * are (`useWarehouseFilter`) — see `useInventoryRows` for why there's no
 * second, local warehouse control on this screen.
 *
 * The reference design always shows one specific warehouse picked (never
 * "All warehouses") — a SKU with stock at both sites otherwise prints one
 * row per site, real but easy to misread as a duplicate. So opening this
 * screen with the shared filter still on "All" narrows it to the first
 * warehouse once, automatically. That's a shared, app-wide setting (the
 * same dropdown Dashboard and Reports use), so this also changes what those
 * screens show next — deliberately, since "All" wasn't the reference state
 * to begin with. "All warehouses" is still choosable from the dropdown for
 * whoever wants to compare both sites at once.
 */

import { useEffect, useRef, useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { Button } from '@/components'
import { AppShell } from '@/features/shell/components/AppShell'
import { downloadFile, toCsv } from '@/domain/csv'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { CreateSkuModal } from '../components/CreateSkuModal'
import { InventoryFilterBar } from '../components/InventoryFilterBar'
import { InventoryTable } from '../components/InventoryTable'
import { SkuDetailPanel } from '../components/SkuDetailPanel'
import { useInventoryRows, type InventoryFilters } from '../hooks/useInventoryRows'
import { useSizeOptions } from '../hooks/useSizeOptions'

const EMPTY_FILTERS: InventoryFilters = {
  level: null,
  sizeId: null,
  isActive: null,
  lowStockOnly: false,
  query: '',
}

export function InventoryScreen() {
  const [filters, setFilters] = useState<InventoryFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  // Which SKU is open, not the row object itself — switching warehouse (or
  // any other filter) refetches `rows`, and a row object captured at click
  // time would keep showing that moment's figures forever. Deriving the
  // displayed row from the live list on every render is what makes the
  // panel follow a warehouse switch instead of going stale. If the SKU
  // drops out of the current view entirely, there's nothing to derive and
  // the panel simply doesn't render — never a stale panel showing a filter
  // that no longer applies.
  const [selectedSkuId, setSelectedSkuId] = useState<number | null>(null)

  const { rows, isLoading } = useInventoryRows(filters)
  const selectedRow = selectedSkuId !== null ? (rows.find((r) => r.skuId === selectedSkuId) ?? null) : null
  const { sizes } = useSizeOptions()

  const { warehouseId, canSwitch, options, select } = useWarehouseFilter()
  // `options` arrives async (a fetch), so this can't fire once on mount —
  // it has to wait for the list to actually load, then act exactly once.
  // The ref is what makes it "once": without it, picking "All warehouses"
  // back deliberately would just get auto-narrowed again on the next render.
  const hasAutoSelected = useRef(false)
  useEffect(() => {
    if (hasAutoSelected.current) return
    if (warehouseId === null && canSwitch && options.length > 0) {
      hasAutoSelected.current = true
      select(options[0].id)
    }
  }, [warehouseId, canSwitch, options, select])

  function applyFilter(next: Partial<InventoryFilters>) {
    setFilters((current) => ({ ...current, ...next }))
    setPage(1)
  }

  function handleExport() {
    const csv = toCsv(
      ['SKU', 'Garment', 'Description', 'Level', 'Size', 'Color', 'Warehouse', 'Available', 'Pick', 'Shipped', 'Min. Stock', 'Value'],
      rows.map((row) => [
        row.skuNumber,
        row.garmentName,
        row.description,
        row.level,
        row.sizeName,
        row.colour,
        row.warehouseName,
        row.available,
        row.pick,
        row.shipped,
        row.minimumQuantity,
        row.value,
      ]),
    )
    downloadFile('inventory-overview.csv', csv)
  }

  return (
    <AppShell title="Inventory">
      <div className={selectedRow ? 'inventory-layout inventory-layout--split' : 'inventory-layout'}>
        <div className="inventory-layout__main">
          <header className="page-head page-head--split inventory-page-head">
            <div>
              <p className="page-head__eyebrow">Inventory / Overview</p>
              <h1 className="page-head__title">Inventory Overview</h1>
            </div>

            {!selectedRow && (
              <div className="modal__foot-actions">
                <Button variant="secondary" onClick={handleExport}>
                  <Download size={16} aria-hidden />
                  Export CSV
                </Button>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus size={16} aria-hidden />
                  Create New SKU
                </Button>
              </div>
            )}
          </header>

          <InventoryFilterBar
            query={filters.query}
            onQueryChange={(query) => applyFilter({ query })}
            level={filters.level}
            onLevelChange={(level) => applyFilter({ level })}
            sizeId={filters.sizeId}
            onSizeChange={(sizeId) => applyFilter({ sizeId })}
            isActive={filters.isActive}
            onIsActiveChange={(isActive) => applyFilter({ isActive })}
            lowStockOnly={filters.lowStockOnly}
            onLowStockOnlyChange={(lowStockOnly) => applyFilter({ lowStockOnly })}
            sizes={sizes}
            isCompact={Boolean(selectedRow)}
            warehouseId={warehouseId}
            warehouses={options}
            onWarehouseChange={select}
          />

          <InventoryTable
            rows={rows}
            loading={isLoading}
            page={page}
            onPageChange={setPage}
            onSelectRow={(row) => setSelectedSkuId(row.skuId)}
            selectedSkuId={selectedSkuId}
            onCreate={() => setIsCreateOpen(true)}
            isCompact={Boolean(selectedRow)}
          />
        </div>

        {selectedRow && (
          <SkuDetailPanel row={selectedRow} onClose={() => setSelectedSkuId(null)} />
        )}
      </div>

      <CreateSkuModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </AppShell>
  )
}
