/**
 * Tailoring Centers — master data (F10), Locations & Administration.
 *
 * A card per centre, each with its own production queue. View-only — adding
 * or editing a tailoring center is not part of this screen.
 */

import { useState } from 'react'
import { AppShell } from '@/features/shell/components/AppShell'
import { Plus, Scissors } from 'lucide-react'
import { Button, EmptyState, Pagination, SkeletonRows } from '@/components'
import { can } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AddTailoringCenterModal } from '../components/AddSiteModal'
import { TailoringCenterCard } from '../components/TailoringCenterCard'
import { useTailoringCenters, type TailoringCenterFilters } from '../hooks/useTailoringCenters'
import { LIST_PAGE_SIZE } from '@/api/pageSize'

const EMPTY_FILTERS: TailoringCenterFilters = { page: 1 }
const PAGE_SIZE = LIST_PAGE_SIZE

export function TailoringCentersScreen() {
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)
  const [filters, setFilters] = useState<TailoringCenterFilters>(EMPTY_FILTERS)

  const { tailoringCenters, totalCount, isLoading } = useTailoringCenters(filters)
  const pageCount = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1)

  return (
    <AppShell title="Tailoring Centers" searchHint="center">
      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Tailoring Centers</h1>
          <p className="page-head__subtitle">
            Oversee outsourced local tailoring centers, active PO allocations, and batch cutting progress.
          </p>
        </div>

        {/* Master data is the Table Updates column — the leads'. */}
        {can(user, 'table_updates') && (
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden />
            Add centre
          </Button>
        )}
      </header>

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : tailoringCenters.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="No tailoring centers yet"
          body="Centres make the garments. Add the first one so production orders have somewhere to go."
          action={
            can(user, 'table_updates')
              ? { label: 'Add centre', onClick: () => setAdding(true) }
              : undefined
          }
        />
      ) : (
        <>
          <div className="tc-list">
            {tailoringCenters.map((center) => (
              <TailoringCenterCard key={center.id} center={center} />
            ))}
          </div>

          <Pagination
            page={filters.page}
            pageCount={pageCount}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            onChange={(page) => setFilters({ page })}
            noun="tailoring centers"
          />
        </>
      )}

      <AddTailoringCenterModal open={adding} onClose={() => setAdding(false)} />
    </AppShell>
  )
}
