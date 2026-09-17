/**
 * The schools list table.
 *
 * Same table shape as the reports ledger (`.ledger`, `.table-scroll`) — one
 * data-table language across the app.
 *
 * Type, Address, Primary Warehouse, Active Orders and Status are all real
 * fields now (`School.is_active`, and `active_orders_count` — annotated on
 * the server, see `SchoolViewSet.get_queryset` for exactly what "active"
 * counts). Students is `School.student_count`, which a lead enters — AsOne
 * has no student roster anywhere in
 * the system, a student is a free-text name on an order, not a record. The
 * server can answer a real, different question instead — distinct student
 * names across every order the school has placed — but that field isn't
 * pushed yet; wire this in once it is, rather than reading a field this
 * client's actual server doesn't have.
 */

import { School as SchoolIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, EmptyState, Pagination } from '@/components'
import { paths } from '@/routes/paths'
import type { School } from '@/api/types'
import { LIST_PAGE_SIZE } from '@/api/pageSize'
import { formatQuantity } from '@/domain/money'

/** DRF's fixed page size — see API_ENDPOINTS.md. */
const PAGE_SIZE = LIST_PAGE_SIZE

interface SchoolsTableProps {
  schools: School[]
  /** Before the client-side text filter — the server's own count for this page of filters. */
  totalCount: number
  loading: boolean
  page: number
  onPageChange: (page: number) => void
  onAdd: () => void
}

export function SchoolsTable({
  schools,
  totalCount,
  loading,
  page,
  onPageChange,
  onAdd,
}: SchoolsTableProps) {
  const navigate = useNavigate()
  const pageCount = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1)

  if (loading) {
    return (
      <div className="skeleton-stack" aria-hidden>
        <span className="skeleton" style={{ height: 40 }} />
        <span className="skeleton" style={{ height: 40 }} />
        <span className="skeleton" style={{ height: 40 }} />
      </div>
    )
  }

  if (schools.length === 0) {
    return (
      <EmptyState
        icon={SchoolIcon}
        title="No schools match this filter"
        body="Try a different type, warehouse, or search term — or add the first school for this filter."
        action={{ label: '+ Add School', onClick: onAdd }}
      />
    )
  }

  return (
    <>
      <div className="schools-table-card">
        {/* `ledger` for the typography every table shares. */}
        <table className="ledger schools-table">
          <thead>
            <tr>
              <th scope="col" className="schools-table__th-name">
                School Name
              </th>
              <th scope="col" className="schools-table__th-type">
                Type
              </th>
              <th scope="col" className="schools-table__th-address">
                Address
              </th>
              <th scope="col" className="schools-table__th-warehouse">
                Primary Warehouse
              </th>
              <th scope="col" className="schools-table__th-num">
                Active Orders
              </th>
              <th scope="col" className="schools-table__th-num">
                Students
              </th>
              <th scope="col" className="schools-table__th-status">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {schools.map((school) => (
              // The whole row opens the school, not just the name — same
              // reasoning as the Orders table (see OrdersTable.tsx): a list
              // of things to open shouldn't make you hunt for the one
              // clickable cell. The name stays a real link too, so
              // middle-click, ctrl-click and the keyboard all still work.
              <tr
                key={school.id}
                className="schools-table__row--clickable"
                onClick={() => navigate(paths.schoolDetail(school.id))}
              >
                <td className="schools-table__td-name">
                  <a
                    className="schools-table__name-link"
                    href={paths.schoolDetail(school.id)}
                    onClick={(event) => {
                      if (!event.metaKey && !event.ctrlKey) event.preventDefault()
                    }}
                  >
                    {school.name}
                  </a>
                </td>
                <td>
                  <Badge tone={school.level === 'HS' ? 'purple' : 'info'}>
                    {school.level_display}
                  </Badge>
                </td>
                <td className="schools-table__td-muted">{school.address || '—'}</td>
                <td className="schools-table__td-muted">{school.primary_warehouse_name}</td>
                <td className="schools-table__td-num schools-table__orders-num">
                  {school.active_orders_count}
                </td>
                {/* Null is "nobody has told us", which is not zero — a
                    school with no students and one nobody has counted are
                    different facts, and printing 0 for the second would
                    understate demand. */}
                <td className="schools-table__td-num">
                  {school.student_count === null || school.student_count === undefined
                    ? '—'
                    : formatQuantity(school.student_count)}
                </td>
                <td className="schools-table__td-status">
                  <Badge tone={school.is_active ? 'success' : 'neutral'}>
                    {school.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        totalItems={totalCount}
        pageSize={PAGE_SIZE}
        onChange={onPageChange}
        noun="schools"
      />
    </>
  )
}
