/**
 * Schools — master data (F12), Locations & Administration.
 *
 * Table Updates only, matching `navigation.ts`'s `requires: 'table_updates'`
 * for this destination — a Program Lead or Operations Manager screen.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components'
import { can } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AppShell } from '@/features/shell/components/AppShell'
import { AddSchoolModal } from '../components/AddSchoolModal'
import { SchoolsFilterBar } from '../components/SchoolsFilterBar'
import { SchoolsTable } from '../components/SchoolsTable'
import { useSchools, type SchoolFilters } from '../hooks/useSchools'
import { useWarehouseOptions } from '../hooks/useWarehouseOptions'

const EMPTY_FILTERS: SchoolFilters = {
  level: null,
  warehouseId: null,
  isActive: null,
  query: '',
  page: 1,
}

export function SchoolsScreen() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<SchoolFilters>(EMPTY_FILTERS)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const { schools, totalCount, isLoading } = useSchools(filters)
  const { warehouses } = useWarehouseOptions()

  /** Any filter change invalidates the current page position. */
  function applyFilter(next: Partial<Omit<SchoolFilters, 'page'>>) {
    setFilters((current) => ({ ...current, ...next, page: 1 }))
  }

  function changePage(page: number) {
    setFilters((current) => ({ ...current, page }))
  }

  return (
    <AppShell title="Schools" searchHint="school">
      {/*
        The add button belongs opposite the title, like Warehouses, Tailoring
        Centers, Users and Inventory. It sat at the end of the filter bar,
        which put a thing that *creates* a school inside the row that
        *narrows* the list of them.
      */}
      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Schools</h1>
          <p className="page-head__subtitle">
            Manage uniform programs, student enrollment ratios, and school dispatch hubs.
          </p>
        </div>

        {can(user, 'table_updates') && (
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus size={16} aria-hidden />
            Add school
          </Button>
        )}
      </header>

      <SchoolsFilterBar
        query={filters.query}
        onQueryChange={(query) => applyFilter({ query })}
        level={filters.level}
        onLevelChange={(level) => applyFilter({ level })}
        warehouseId={filters.warehouseId}
        onWarehouseChange={(warehouseId) => applyFilter({ warehouseId })}
        isActive={filters.isActive}
        onIsActiveChange={(isActive) => applyFilter({ isActive })}
        warehouses={warehouses}
      />

      <SchoolsTable
        schools={schools}
        totalCount={totalCount}
        loading={isLoading}
        page={filters.page}
        onPageChange={changePage}
        onAdd={() => setIsAddModalOpen(true)}
      />

      <AddSchoolModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        warehouses={warehouses}
      />
    </AppShell>
  )
}
