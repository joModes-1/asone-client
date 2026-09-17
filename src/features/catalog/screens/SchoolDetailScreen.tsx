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
import { formatDay } from '@/domain/dates'
import { formatQuantity } from '@/domain/money'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
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

/*
 * What each tab will show, said to the person looking at it.
 *
 * These render straight into an `EmptyState` on screen. They used to name
 * API paths, talk about "this role", and say things like "the KPI
 * definitions aren't settled" and "a good candidate to build first" — notes
 * from one developer to another, shown to a school clerk. What somebody
 * wants from an empty tab is what belongs there, why it is empty, and where
 * to look meanwhile.
 */
const NON_ORDERS_TAB_GAPS: Record<Exclude<SchoolTab, 'Orders'>, { title: string; body: string }> = {
  Students: {
    title: 'No student list',
    body: 'A student is a name written on an order rather than a record the system keeps, so there is no roster to show. Every order on the Orders tab names the student it is for.',
  },
  Shipments: {
    title: 'Shipments are not shown here yet',
    body: 'What has been picked for this school and is waiting for a van is on the Shipping screen. This tab will bring it together per school.',
  },
  Backorders: {
    title: 'Backorders are not shown here yet',
    body: 'Orders this school is waiting on stock for are on the Backorders screen. This tab will bring them together per school.',
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

      {/*
        The dashboard's own `KpiCard` and `.kpi-row`, not a second tile that
        looked nearly like it. These were `school-kpi-card` — figure on top,
        icon and label beneath — while the dashboard pairs the icon with the
        figure and puts the category last. Two tile shapes for the same kind
        of fact.

        Every figure arrives as a formatted string, which is what `KpiCard`
        takes: a raw number here would print 1234 where the rest of the app
        prints 1,234.
      */}
      <div className="kpi-row">
        <KpiCard
          label="Total Students"
          value={
            school.student_count === null || school.student_count === undefined
              ? '—'
              : formatQuantity(school.student_count)
          }
          caption="Enrolled, as the school reports it"
          icon={Users}
        />
        <KpiCard
          label="Active Orders"
          value={formatQuantity(school.active_orders_count)}
          caption="Placed and not yet delivered"
          icon={Package}
        />
        <KpiCard
          label="Total Revenue"
          value="—"
          caption="Not totalled per school yet"
          icon={TrendingUp}
        />
        <KpiCard
          label="Pending Shipments"
          value="—"
          caption="Not counted per school yet"
          icon={Truck}
        />
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
    /*
     * `.table-card` and `.ledger`, like every other table in the app. This
     * arrived as its own `school-orders-table` with its own cell classes and
     * inline `textAlign` styles, so the same kind of table — an order list —
     * looked different here from Orders, Inventory and everywhere else.
     */
    <div className="table-card">
      <div className="table-scroll">
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Order #</th>
            <th scope="col">Student</th>
            <th scope="col">Uniform Items</th>
            <th scope="col" className="ledger__nowrap">
              Total (UGX)
            </th>
            <th scope="col" className="ledger__nowrap">
              Order Status
            </th>
            <th scope="col" className="ledger__nowrap">
              Order Date
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="ledger__link">{order.number}</td>
              <td className="ledger__strong">{order.student_name}</td>
              <td
                className="ledger__wrap"
                title={order.lines
                  .map((line) => `${line.sku_description} (${line.quantity})`)
                  .join(', ')}
              >
                {order.lines
                  .map((line) => `${line.sku_description} (${line.quantity})`)
                  .join(', ')}
              </td>
              <td>
                <span className="order-total">
                  <span className="order-total__value">{formatUGX(order.total)}</span>
                  <Badge tone={paymentTone(order)}>{paymentLabel(order)}</Badge>
                </span>
              </td>
              <td>
                <Badge tone={schoolOrderTone(order.status)}>{order.status_display}</Badge>
              </td>
              <td className="ledger__nowrap">{formatDay(order.order_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

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
