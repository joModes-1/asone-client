/**
 * School detail — header, KPIs, and sections.
 *
 * The header, Active Orders, Status, and the Orders tab are all real now.
 * Orders became buildable once the backend widened `SchoolOrderViewSet` to
 * let both leads read the list (9 September 2026, pending AsOne's written
 * confirmation) and added a `?school=` filter alongside it — see
 * `orders/views.py`. Before that, this tab showed an honest "not available
 * for this role" message, which was correct at the time but is stale now
 * that the underlying access actually changed.
 *
 * Total Students remains a gap: there is no student roster anywhere in the
 * system (a student is a free-text name on an order, not a record). The
 * server has a `distinct_students_count` field ready to answer this from
 * the same order list, but it isn't pushed yet — wire this in once it is,
 * rather than reading a field this client's actual server doesn't have.
 *
 * Total Revenue and Pending Shipments are left as gaps for now even though
 * the same order list this screen fetches could answer both — worth wiring
 * once that's confirmed wanted, rather than doing it silently alongside an
 * unrelated fix. The Students, Shipments and Backorders tabs are gaps for
 * the same reasons as before — see TAB_GAPS.
 *
 * Earlier drafts of this screen filled every gap with fake numbers — a
 * hardcoded demo-orders table shown for every school regardless of which
 * one was open, and per-school KPI figures keyed off the school's name.
 * Removed: a dash or a stated gap is honest, but numbers that look real and
 * are not are actively misleading, worse than the gap they were covering.
 */

import {
  MapPin,
  Package,
  PackageX,
  School as SchoolIcon,
  TrendingUp,
  Truck,
  Users,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, EmptyState, LoadingScreen, Pagination } from '@/components'
import { formatUGX } from '@/domain/money'
import { paymentLabel, paymentTone, schoolOrderTone } from '@/domain/status'
import { AppShell } from '@/features/shell/components/AppShell'
import { paths } from '@/routes/paths'
import { AddSchoolModal } from '../components/AddSchoolModal'
import { useSchool } from '../hooks/useSchool'
import { useSchoolOrdersForSchool } from '../hooks/useSchoolOrdersForSchool'
import { useWarehouseOptions } from '../hooks/useWarehouseOptions'
import type { SchoolOrder } from '@/api/types'

const TABS = ['Orders', 'Students', 'Shipments', 'Backorders'] as const
type SchoolTab = (typeof TABS)[number]

const NON_ORDERS_TAB_GAPS: Record<Exclude<SchoolTab, 'Orders'>, { title: string; body: string }> = {
  Students: {
    title: 'Students — not a concept in the system yet',
    body: 'AsOne has no student roster. A student is a free-text name on an order, not a database record — showing a list here means deciding whether students become a real entity first.',
  },
  Shipments: {
    title: 'Shipments — not wired yet, but the data is reachable',
    body: '/orders/reports/part-processed/ (picked, awaiting despatch) is actually readable by this role already. Held back only because it has no school filter yet and the KPI definitions aren’t settled — a good candidate to build first.',
  },
  Backorders: {
    title: 'Backorders — not wired yet, but the data is reachable',
    body: '/orders/reports/backorders/ is readable by this role already, and it is the widest-audience report in the system. Held back for the same reason as Shipments: no school filter yet, and the figures haven’t been agreed.',
  },
}

export function SchoolDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const schoolId = Number(id)
  const navigate = useNavigate()
  const { school, isLoading } = useSchool(schoolId)
  const [tab, setTab] = useState<SchoolTab>('Orders')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [ordersPage, setOrdersPage] = useState(1)
  const {
    orders,
    totalCount: ordersTotal,
    pageSize: ordersPageSize,
    isLoading: ordersLoading,
    isError: ordersErrored,
  } = useSchoolOrdersForSchool(schoolId, ordersPage)
  const { warehouses } = useWarehouseOptions()

  if (isLoading) return <LoadingScreen message="Loading school…" />

  if (!school) {
    return (
      <AppShell title="School not found">
        <EmptyState
          icon={SchoolIcon}
          title="School not found"
          body="It may have been removed, or the link is wrong."
          action={{ label: 'Back to Schools', onClick: () => navigate(paths.schools) }}
        />
      </AppShell>
    )
  }

  return (
    <AppShell title={school.name}>
      <div className="page-head">
        <p className="page-head__eyebrow">Schools / Details</p>
        <h1 className="page-head__title">{school.name}</h1>
        <p className="page-head__subtitle">
          Registration, order statuses, and batch fulfillment schedules.
        </p>
      </div>

      <div className="school-summary-card">
        <div className="school-summary-card__top">
          <div className="school-summary-card__title-row">
            <h2 className="school-summary-card__title">{school.name}</h2>
            <Badge tone={school.level === 'HS' ? 'purple' : 'info'}>{school.level_display}</Badge>
            <Badge tone={school.is_active ? 'success' : 'neutral'}>
              {school.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div className="school-summary-card__actions">
            <button
              type="button"
              className="school-summary-card__btn-secondary"
              onClick={() => setIsEditOpen(true)}
            >
              Edit Details
            </button>
            <button
              type="button"
              className="school-summary-card__btn-primary"
              disabled
              title="Placing an order is School Staff only — a lead's account has no school to place one for."
            >
              + New Student Order
            </button>
          </div>
        </div>

        <div className="school-summary-card__meta">
          {school.address && (
            <span className="school-summary-card__meta-item">
              <MapPin size={14} className="school-summary-card__meta-icon" aria-hidden />
              {school.address}
            </span>
          )}
          <span className="school-summary-card__meta-item">
            <WarehouseIcon size={14} className="school-summary-card__meta-icon" aria-hidden />
            {school.primary_warehouse_name}
          </span>
        </div>
      </div>

      <div className="school-kpi-grid">
        <div className="school-kpi-card">
          <div className="school-kpi-card__value">—</div>
          <div className="school-kpi-card__footer">
            <Users size={16} aria-hidden />
            <span>Total Students</span>
          </div>
        </div>

        <div className="school-kpi-card">
          <div className="school-kpi-card__value">{school.active_orders_count}</div>
          <div className="school-kpi-card__footer">
            <Package size={16} aria-hidden />
            <span>Active Orders</span>
          </div>
        </div>

        <div className="school-kpi-card">
          <div className="school-kpi-card__value">—</div>
          <div className="school-kpi-card__footer">
            <TrendingUp size={16} aria-hidden />
            <span>Total Revenue</span>
          </div>
        </div>

        <div className="school-kpi-card">
          <div className="school-kpi-card__value">—</div>
          <div className="school-kpi-card__footer">
            <Truck size={16} aria-hidden />
            <span>Pending Shipments</span>
          </div>
        </div>
      </div>

      <div className="school-tabs-container">
        <div className="school-tabs-nav">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`school-tabs-nav__item ${
                tab === t ? 'school-tabs-nav__item--active' : ''
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="detail-tabs__panel">
          {tab === 'Orders' ? (
            <SchoolOrdersPanel
              orders={orders}
              loading={ordersLoading}
              errored={ordersErrored}
              page={ordersPage}
              totalCount={ordersTotal}
              pageSize={ordersPageSize}
              onPageChange={setOrdersPage}
            />
          ) : (
            <EmptyState
              icon={PackageX}
              title={NON_ORDERS_TAB_GAPS[tab].title}
              body={NON_ORDERS_TAB_GAPS[tab].body}
            />
          )}
        </div>
      </div>

      <AddSchoolModal
        // React Router doesn't remount this screen when navigating between
        // two different schools' detail pages (same route element, params
        // just change) — without a key here, the modal's internal state
        // would carry over from whichever school it last opened for. Same
        // fix as the Warehouses/Tailoring Centers modals, see those screens.
        key={school.id}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        warehouses={warehouses}
        school={school}
      />
    </AppShell>
  )
}

/**
 * The real Orders table — see the module comment for what unlocked this.
 *
 * Paginated the same way `/orders` pages the full list — same `Pagination`
 * component, same footer placement — rather than fetching every order a
 * school has ever placed into one ever-growing table.
 */
function SchoolOrdersPanel({
  orders,
  loading,
  errored,
  page,
  totalCount,
  pageSize,
  onPageChange,
}: {
  orders: SchoolOrder[]
  loading: boolean
  errored: boolean
  page: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  if (loading) {
    return (
      <div className="skeleton-stack" aria-hidden>
        <span className="skeleton" style={{ height: 40 }} />
        <span className="skeleton" style={{ height: 40 }} />
      </div>
    )
  }

  if (errored) {
    return (
      <EmptyState
        icon={PackageX}
        title="Couldn't load this school's orders"
        body="Something went wrong reaching the server. Try again in a moment."
      />
    )
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={PackageX}
        title="No orders yet"
        body="Nothing has been placed for this school so far."
      />
    )
  }

  const pageCount = Math.max(Math.ceil(totalCount / pageSize), 1)

  return (
    <div className="school-orders-table-card">
      <table className="school-orders-table">
        <thead>
          <tr>
            <th scope="col">Order #</th>
            <th scope="col">Student</th>
            <th scope="col">Uniform Items</th>
            <th scope="col" style={{ textAlign: 'right' }}>
              Total / Payment
            </th>
            <th scope="col" style={{ textAlign: 'center' }}>
              Status
            </th>
            <th scope="col" style={{ textAlign: 'right' }}>
              Order Date
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="school-orders-table__td-num">{order.number}</td>
              <td className="school-orders-table__td-student">{order.student_name}</td>
              <td className="school-orders-table__td-items">
                {order.lines.map((line) => `${line.sku_description} (${line.quantity})`).join(', ')}
              </td>
              <td className="school-orders-table__td-payment">
                <div className="school-orders-table__td-payment-wrap">
                  <span className="school-orders-table__amount">{formatUGX(order.total)}</span>
                  <Badge tone={paymentTone(order)}>{paymentLabel(order)}</Badge>
                </div>
              </td>
              <td className="school-orders-table__td-status">
                <Badge tone={schoolOrderTone(order.status)}>{order.status_display}</Badge>
              </td>
              <td className="school-orders-table__td-date">{order.order_date}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="table-card__footer">
        <Pagination
          page={Math.min(page, pageCount)}
          pageCount={pageCount}
          totalItems={totalCount}
          pageSize={pageSize}
          onChange={onPageChange}
          noun="orders"
        />
      </div>
    </div>
  )
}
