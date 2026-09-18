/**
 * Warehouses — master data (F11), Locations & Administration.
 *
 * One card per site, not a table row: each warehouse is its own operation
 * with its own stock and queues, which is what the four stats on
 * `WarehouseCard` are for. View-only — adding or editing a warehouse is not
 * part of this screen.
 *
 * "View Dashboard" opens `WarehouseDetailScreen` — the hub console — at
 * `/warehouses/:id`, not the general `/dashboard` overview: a different
 * screen for a different question, one warehouse's own production queue,
 * picking queue and dispatch log rather than every site's KPIs at once.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/features/shell/components/AppShell'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { Plus, Warehouse as WarehouseIcon } from 'lucide-react'
import { Button, EmptyState, Pagination, SkeletonRows } from '@/components'
import { can } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTailoringCenters } from '../hooks/useTailoringCenters'
import { AddWarehouseModal } from '../components/AddSiteModal'
import { paths } from '@/routes/paths'
import { WarehouseCard } from '../components/WarehouseCard'
import { useWarehouses, type WarehouseFilters } from '../hooks/useWarehouses'
import { useWarehouseSummaries } from '../hooks/useWarehouseSummaries'
import type { Warehouse } from '@/api/types'
import { LIST_PAGE_SIZE } from '@/api/pageSize'

const EMPTY_FILTERS: WarehouseFilters = { page: 1 }
const PAGE_SIZE = LIST_PAGE_SIZE

export function WarehousesScreen() {
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)
  const [filters, setFilters] = useState<WarehouseFilters>(EMPTY_FILTERS)
  const { tailoringCenters } = useTailoringCenters({ page: 1 })
  const navigate = useNavigate()
  const warehouseFilter = useWarehouseFilter()

  const { warehouses, totalCount, isLoading } = useWarehouses(filters)
  const { summaries, isLoading: summariesLoading } = useWarehouseSummaries(
    warehouses.map((warehouse) => warehouse.id),
  )

  function viewDashboard(warehouse: Warehouse) {
    navigate(paths.warehouseDetail(warehouse.id))
  }

  function viewInventory(warehouse: Warehouse) {
    warehouseFilter.select(warehouse.id)
    navigate(paths.inventory)
  }

  const pageCount = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1)

  return (
    <AppShell title="Warehouses" searchHint="warehouse">
      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Warehouses</h1>
          <p className="page-head__subtitle">
            Centralized inventory tracking, regional tailoring centers, and distribution metrics.
          </p>
        </div>

        {/* Master data is the Table Updates column — the leads'. */}
        {can(user, 'table_updates') && (
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden />
            Add warehouse
          </Button>
        )}
      </header>

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : warehouses.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses yet"
          body="A warehouse holds stock and ships to the schools around it. Add the first one to start receiving against production orders."
          action={
            can(user, 'table_updates')
              ? { label: 'Add warehouse', onClick: () => setAdding(true) }
              : undefined
          }
        />
      ) : (
        <>
          <div className="site-card-grid">
            {warehouses.map((warehouse) => (
              <WarehouseCard
                key={warehouse.id}
                warehouse={warehouse}
                summary={summaries.get(warehouse.id) ?? null}
                loading={summariesLoading}
                onViewDashboard={() => viewDashboard(warehouse)}
                onViewInventory={() => viewInventory(warehouse)}
              />
            ))}
          </div>

          <Pagination
            page={filters.page}
            pageCount={pageCount}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            onChange={(page) => setFilters({ page })}
            noun="warehouses"
          />
        </>
      )}

      <AddWarehouseModal
        open={adding}
        onClose={() => setAdding(false)}
        tailoringCenters={tailoringCenters}
      />
    </AppShell>
  )
}
