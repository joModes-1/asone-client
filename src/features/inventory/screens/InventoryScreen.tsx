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

import { useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { SplitButton, TabBar } from '@/components'
import { can } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AppShell } from '@/features/shell/components/AppShell'
import { downloadFile, toCsv } from '@/domain/csv'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { INVENTORY_EXPORT_HEADERS } from '@/domain/stockCount'
import { CreateSkuModal } from '../components/CreateSkuModal'
import { CreateGarmentModal, CreateSizeModal } from '../components/CreateGarmentModal'
import { ImportCountModal } from '../components/ImportCountModal'
import { ImportGarmentsModal } from '../components/ImportGarmentsModal'
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
  const [isGarmentImportOpen, setIsGarmentImportOpen] = useState(false)
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
  /**
   * Which row the detail panel is showing — a SKU **and** a warehouse.
   *
   * The SKU id alone was ambiguous and silently wrong. The table holds one
   * row per SKU per warehouse, so `rows.find(r => r.skuId === id)` always
   * returned the *first* warehouse's row whichever one was clicked: open
   * the Serere line and the panel showed Namayemba's figures.
   *
   * The edit dialogue made that costly rather than merely confusing. Its
   * minimum-stock field writes against `row.warehouseId`, so a floor set
   * from the Serere row landed on Namayemba — a quiet wrong answer, on the
   * warehouse nobody was looking at.
   */
  const [selected, setSelected] = useState<{ skuId: number; warehouseId: number } | null>(
    null,
  )

  const { user } = useAuth()
  // Garments and sizes are the leads' column (F05) — narrower than SKUs,
  // which everybody can read. The menu hides what the server would refuse.
  const mayEditCatalogue = can(user, 'table_updates')

  const { rows, isLoading } = useInventoryRows(filters)
  const selectedRow =
    selected !== null
      ? (rows.find(
          (r) => r.skuId === selected.skuId && r.warehouseId === selected.warehouseId,
        ) ?? null)
      : null
  const { sizes } = useSizeOptions()
  const canAdjustInventory = can(user, 'inventory_adjustments')

  const { warehouseId, options, select } = useWarehouseFilter()
  /*
   * Opening Inventory used to narrow itself to the first warehouse as soon
   * as the warehouse list loaded. Removed: it answered a question nobody had
   * asked, and answered it differently depending on which warehouse happened
   * to sort first.
   *
   * "All warehouses" is already a supported state everywhere downstream —
   * `useInventoryRows` reads `warehouseId === null` as every site the role
   * may see — so there was nothing to protect against. What it did instead
   * was hide half the stock from a lead who had opened the screen to look at
   * all of it, with a filter they had not set and might not notice.
   *
   * A lead who wants one site picks it. Site-bound roles are pinned by the
   * server regardless (see `StockLevelView`), so this never applied to them.
   */

  function applyFilter(next: Partial<InventoryFilters>) {
    setFilters((current) => ({ ...current, ...next }))
    setPage(1)
  }

  /**
   * The overview as a file, and a stock-count sheet in the same breath.
   *
   * `Counted` is written deliberately empty. Exporting and importing straight
   * back used to fail with "must include one called SKU and one called
   * Counted" — the export had SKU and Warehouse but nothing to count into,
   * so the obvious round trip was the one thing that did not work.
   *
   * It sits between the identity columns and the system's own figures: that
   * is where somebody walking the shelves writes, and it keeps Available
   * next to it to compare against. It is never pre-filled with Available —
   * importing the system's own numbers back would post no differences while
   * looking like a count had happened.
   */
  function handleExport() {
    const csv = toCsv(
      INVENTORY_EXPORT_HEADERS,
      rows.map((row) => [
        row.skuNumber,
        row.garmentName,
        row.description,
        row.level,
        row.sizeName,
        row.colour,
        row.warehouseName,
        '',
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
                  options={
                    /*
                     * A stock count posts inventory adjustments, which
                     * AsOne's matrix gives to Finance alone — so every other
                     * role could fill the whole dialogue in, press go, and
                     * collect one "Your role does not have access to this
                     * function" per row. Hidden rather than shown-and-
                     * refused, the same way New garment is.
                     *
                     * Export stays for everyone: reading the sheet is not
                     * the part anybody lacks.
                     *
                     * Worth knowing this is open question Q3 — the column is
                     * Finance-only as written, which means the warehouse
                     * that does the counting cannot post its own result. If
                     * AsOne widen that cell, this follows automatically.
                     */
                    canAdjustInventory
                      ? [
                          {
                            label: 'Import stock count…',
                            hint: 'A counted quantity per SKU. The system posts the difference.',
                            onSelect: () => setIsImportOpen(true),
                          },
                        ]
                      : []
                  }
                >
                  <Download size={16} aria-hidden />
                  Export CSV
                </SplitButton>
                )}

                {/*
                  Creating a SKU is master data — the leads', like garments
                  and sizes in its own menu. This was shown to every role, so
                  a school clerk and a warehouse clerk were both offered a
                  button that answers 403: the catalogue is something they
                  read, not something they add to.
                */}
                {mayEditCatalogue && (
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
                          {
                            // Deliberately not beside "Import stock count…".
                            // That one posts to an append-only ledger and is
                            // undone only by posting more; this creates
                            // products, which can be edited. Sitting them
                            // together would make the two look equivalent.
                            label: 'Import garments…',
                            hint: 'A spreadsheet of garments, sizes and prices.',
                            onSelect: () => setIsGarmentImportOpen(true),
                          },
                        ]
                      : []
                  }
                >
                  <Plus size={16} aria-hidden />
                  Create New SKU
                </SplitButton>
                )}
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
            canCreate={mayEditCatalogue}
            page={page}
            onPageChange={setPage}
            onSelectRow={(row) =>
              setSelected({ skuId: row.skuId, warehouseId: row.warehouseId })
            }
            selectedSkuId={selected?.skuId ?? null}
            selectedWarehouseId={selected?.warehouseId ?? null}
            onCreate={() => setIsCreateOpen(true)}
            isCompact={Boolean(selectedRow)}
          />
            </>
          )}
        </div>

        {selectedRow && (
          <SkuDetailPanel
            row={selectedRow}
            onClose={() => setSelected(null)}
            onEdit={() => setIsEditOpen(true)}
          />
        )}
      </div>

      <CreateSkuModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <CreateGarmentModal open={isGarmentOpen} onClose={() => setIsGarmentOpen(false)} />
      <CreateSizeModal open={isSizeOpen} onClose={() => setIsSizeOpen(false)} />
      <ImportCountModal open={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <ImportGarmentsModal
        open={isGarmentImportOpen}
        onClose={() => setIsGarmentImportOpen(false)}
      />
      <EditSkuModal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        row={selectedRow}
      />
    </AppShell>
  )
}
