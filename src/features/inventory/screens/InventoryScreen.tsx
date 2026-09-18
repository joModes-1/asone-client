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
import { SplitButton, TabBar } from '@/components'
import { can } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AppShell } from '@/features/shell/components/AppShell'
import { downloadFile, toCsv } from '@/domain/csv'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { CreateSkuModal } from '../components/CreateSkuModal'
import { CreateGarmentModal, CreateSizeModal } from '../components/CreateGarmentModal'
import { ImportCountModal } from '../components/ImportCountModal'
import { EditSkuModal } from '../components/EditSkuModal'
import { GarmentsTab } from '../components/GarmentsTab'
import { InventoryFilterBar } from '../components/InventoryFilterBar'
import { InventoryTable } from '../components/InventoryTable'
import { SkuDetailPanel } from '../components/SkuDetailPanel'
import { useInventoryRows, type InventoryFilters } from '../hooks/useInventoryRows'
import { useSizeOptions } from '../hooks/useSizeOptions'

/*
 * Two tabs, one destination. Stock answers how many; Garments answers what
 * they are and what they cost. Garments and SKUs used to be two more sidebar
 * entries leading to placeholder screens — Stock *is* the SKU list, so that
 * one never needed a screen, and this is all the garment table ever needed.
 */
const TABS = [
  { key: 'stock', label: 'Stock' },
  { key: 'garments', label: 'Garments' },
] as const
type TabKey = (typeof TABS)[number]['key']

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
  const [isGarmentOpen, setIsGarmentOpen] = useState(false)
  const [isSizeOpen, setIsSizeOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>('stock')
  // Which SKU is open, not the row object itself — switching warehouse (or
  // any other filter) refetches `rows`, and a row object captured at click
  // time would keep showing that moment's figures forever. Deriving the
  // displayed row from the live list on every render is what makes the
  // panel follow a warehouse switch instead of going stale. If the SKU
  // drops out of the current view entirely, there's nothing to derive and
  // the panel simply doesn't render — never a stale panel showing a filter
  // that no longer applies.
  const [selectedSkuId, setSelectedSkuId] = useState<number | null>(null)

  const { user } = useAuth()
  // Garments and sizes are the leads' column (F05) — narrower than SKUs,
  // which everybody can read. The menu hides what the server would refuse.
  const mayEditCatalogue = can(user, 'table_updates')

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
          {/*
            The same head as every other screen: a green title and a sentence
            under it. The reference design has an "Inventory / Overview"
            eyebrow above a dark title, but an eyebrow is the breadcrumb on a
            *detail* screen here, and nothing else in the app puts one on a
            top-level destination or darkens its title.
          */}
          <header className="page-head page-head--split">
            <div>
              <h1 className="page-head__title">Inventory</h1>
              <p className="page-head__subtitle">
                Every SKU and what each warehouse holds of it.
              </p>
            </div>

            {/*
              Two split buttons rather than four plain ones.

              The common action on each — export, and create a SKU — stays a
              single click; the occasional ones sit behind the caret. Folding
              everything into one menu would have tidied the head by burying
              the thing people came to do.

              Garments and sizes are leads-only (F05), so those two options
              are hidden rather than shown-and-refused for anybody else.
            */}
            {/*
              The Create button stays on both tabs — its caret is where New
              garment lives, which is the thing you want while looking at the
              garment table. Export is stock-only: exporting the SKU rows
              from a screen showing garments would hand you the wrong file.
            */}
            {!selectedRow && (
              <div className="page-head__actions">
                {tab === 'stock' && (
                <SplitButton
                  variant="secondary"
                  menuLabel="More data options"
                  onClick={handleExport}
                  options={[
                    {
                      label: 'Import stock count…',
                      hint: 'A counted quantity per SKU. The system posts the difference.',
                      onSelect: () => setIsImportOpen(true),
                    },
                  ]}
                >
                  <Download size={16} aria-hidden />
                  Export CSV
                </SplitButton>
                )}

                <SplitButton
                  menuLabel="More create options"
                  onClick={() => setIsCreateOpen(true)}
                  options={
                    mayEditCatalogue
                      ? [
                          {
                            label: 'New garment…',
                            hint: 'A uniform component, before a size is chosen.',
                            onSelect: () => setIsGarmentOpen(true),
                          },
                          {
                            label: 'New size…',
                            hint: 'Shared across garments.',
                            onSelect: () => setIsSizeOpen(true),
                          },
                        ]
                      : []
                  }
                >
                  <Plus size={16} aria-hidden />
                  Create New SKU
                </SplitButton>
              </div>
            )}
          </header>

          {/* Garments is leads-only; hiding the tab is kinder than a tab
              that leads to a table nobody else may read. */}
          <TabBar
            label="Inventory views"
            active={tab}
            onSelect={(key) => setTab(key as TabKey)}
            tabs={mayEditCatalogue ? TABS : TABS.filter((entry) => entry.key === 'stock')}
          />

          {tab === 'garments' ? (
            <GarmentsTab />
          ) : (
            <>
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
            </>
          )}
        </div>

        {selectedRow && (
          <SkuDetailPanel
            row={selectedRow}
            onClose={() => setSelectedSkuId(null)}
            onEdit={() => setIsEditOpen(true)}
          />
        )}
      </div>

      <CreateSkuModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <CreateGarmentModal open={isGarmentOpen} onClose={() => setIsGarmentOpen(false)} />
      <CreateSizeModal open={isSizeOpen} onClose={() => setIsSizeOpen(false)} />
      <ImportCountModal open={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <EditSkuModal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        row={selectedRow}
      />
    </AppShell>
  )
}
