/**
 * The school's dashboard — the other half of F62.
 *
 * A school sees none of the warehouse tiles, and that is deliberate rather
 * than a gap: it holds no stock, runs no bins and picks nothing, so "16,482
 * items available" would be a figure about somebody else's building.
 *
 * What it is shown is the state of its own paperwork, in the order a school
 * actually needs it:
 *
 *   Deliveries to confirm   first, because it is the only panel the school
 *                           can act on, and every row is a parcel somebody
 *                           should be looking for.
 *   Orders by state         what is owed, what the warehouse has, what is
 *                           done.
 *   Backorders              the answer to "where is my child's shirt" when
 *                           it is not lost, just not made yet.
 *
 * Every figure comes from `/dashboard/school/`, which is scoped to the
 * caller's own school on the server. There is no school picker, because a
 * clerk has exactly one school.
 */

import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, PackageCheck, Wallet } from 'lucide-react'
import { LoadingScreen, Panel } from '@/components'
import { formatCompactUGX } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { KpiCard } from '../components/KpiCard'
import { PREVIEW } from '../previewLimits'
import { useSchoolDashboard } from '../hooks/useSchoolDashboard'

/** A figure that has not arrived reads as a dash, never a zero. */
function figure(value: number | undefined): string {
  return value === undefined ? '—' : String(value)
}

export function SchoolDashboardScreen() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useSchoolDashboard()

  if (isLoading) return <LoadingScreen message="Loading your dashboard" />

  if (isError || !data) {
    return (
      <AppShell title="Dashboard overview">
        <p className="panel__clear">Your dashboard could not be loaded.</p>
      </AppShell>
    )
  }

  const { orders, deliveries_to_confirm: deliveries, backorders } = data

  // A dashboard summarises; the full lists live behind it. Same limits as
  // every other panel on the home screen.
  const shownDeliveries = deliveries.slice(0, PREVIEW.alerts)
  const shownBackorders = backorders.slice(0, PREVIEW.alerts)

  return (
    <AppShell title="Dashboard overview">
      <header className="page-head">
        <h1 className="page-head__title">{data.school.name}</h1>
        <p className="page-head__subtitle">
          {data.warehouse
            ? `Orders filled from ${data.warehouse.name}`
            : 'Your uniform orders'}
          {user ? ` · ${user.role_display}` : ''}
        </p>
      </header>

      <div className="kpi-row">
        <KpiCard
          label="Awaiting Payment"
          value={figure(orders.awaiting_payment)}
          caption="Invoices not yet paid"
          icon={Wallet}
          tone={orders.awaiting_payment > 0 ? 'alert' : 'default'}
        />
        <KpiCard
          label="Amount Outstanding"
          /* Compact, like every other figure on a tile — the warehouse
             dashboard's Inventory Value already reads "UGX 48.2M". A tile is
             a fixed-width box read at a glance, and "UGX 1,240,000" either
             overflows it or shrinks the rest of the row to fit. The exact
             figure belongs where somebody pays against it: the order table
             on the school's detail screen, which keeps `formatUGX`. */
          value={formatCompactUGX(data.amount_outstanding)}
          caption="Value of unpaid invoices"
          icon={Wallet}
        />
        <KpiCard
          label="With the Warehouse"
          value={figure(orders.in_progress)}
          caption="Paid and being prepared"
          icon={Clock}
        />
        {/*
          Clickable, unlike its neighbours: this is the school's own to-do
          list, not a figure it merely reads. The other tiles report what the
          warehouse is doing, and there is nothing for a school to act on in
          them.
        */}
        <KpiCard
          label="To Confirm"
          value={figure(orders.awaiting_confirmation)}
          caption="Shipped, not yet received"
          icon={PackageCheck}
          tone={orders.awaiting_confirmation > 0 ? 'alert' : 'default'}
          to={orders.awaiting_confirmation > 0 ? '/orders' : undefined}
        />
        <KpiCard
          label="Completed"
          value={figure(orders.completed)}
          caption="Delivered and confirmed"
          icon={CheckCircle2}
        />
        <KpiCard
          label="Backordered"
          value={figure(backorders.length)}
          caption="Waiting on stock"
          icon={AlertTriangle}
          tone={backorders.length > 0 ? 'alert' : 'default'}
        />
      </div>

      <div className="dashboard__columns">
        <div className="dashboard__col">
          <Panel
            title="Deliveries to Confirm"
            minHeight="var(--panel-h-attention)"
            meta={
              deliveries.length > 0 ? (
                <span className="panel__count">
                  {deliveries.length} PARCEL{deliveries.length === 1 ? '' : 'S'}
                </span>
              ) : undefined
            }
            viewAll={
              deliveries.length > shownDeliveries.length
                ? { to: '/orders', total: deliveries.length, noun: 'deliveries' }
                : undefined
            }
          >
            {deliveries.length === 0 ? (
              /*
                The system's empty state: says what would be here and what
                puts it there, rather than a bare "No data".
              */
              <p className="panel__clear">
                <CheckCircle2 size={18} aria-hidden />
                Nothing in transit — parcels appear here when a warehouse ships them.
              </p>
            ) : (
              <ul className="attention">
                {shownDeliveries.map((delivery) => (
                  <li className="attention__item" key={delivery.id}>
                    <span className="attention__label">
                      <PackageCheck size={18} aria-hidden />
                      <Link to={`/orders/${delivery.order_id}`}>{delivery.order_number}</Link>
                      {' · '}
                      {delivery.student_name}
                    </span>
                    {/*
                      Days in transit rather than the date: the school is being
                      asked to notice the old ones, and "18 days" says that
                      where "22 Oct" does not.
                    */}
                    <span
                      className={`attention__tag attention__tag--${
                        delivery.days_in_transit > 14 ? 'error' : 'warning'
                      }`}
                    >
                      {delivery.days_in_transit === 0
                        ? 'SENT TODAY'
                        : `${delivery.days_in_transit} DAYS`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="dashboard__col dashboard__col--narrow">
          <Panel
            title="Waiting on Stock"
            minHeight="var(--panel-h-attention)"
            viewAll={
              backorders.length > shownBackorders.length
                ? { to: '/orders', total: backorders.length, noun: 'backorders' }
                : undefined
            }
          >
            {backorders.length === 0 ? (
              <p className="panel__clear">
                <CheckCircle2 size={18} aria-hidden />
                Every item you have ordered was in stock.
              </p>
            ) : (
              <ul className="attention">
                {shownBackorders.map((backorder) => (
                  <li className="attention__item" key={backorder.id}>
                    <span className="attention__label">
                      <AlertTriangle size={18} aria-hidden />
                      {backorder.quantity} × {backorder.sku_description}
                    </span>
                    <span
                      className={`attention__tag attention__tag--${
                        backorder.status === 'OPEN' ? 'warning' : 'info'
                      }`}
                    >
                      {backorder.status === 'OPEN' ? 'UNASSIGNED' : 'BEING FILLED'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

    </AppShell>
  )
}
