/**
 * One warehouse, as a card — the Warehouses list's real unit, not a table
 * row.
 *
 * The four stats are real, not mockup filler: they come straight from
 * `/api/dashboard/summary/?warehouse=`, the same endpoint the warehouse
 * hub console itself uses. Address and Primary Tailoring Center show what
 * the server actually has — the server models a missing one as `null`,
 * which is a legitimate state, not a gap to paper over with a guessed
 * street name or a made-up tailoring centre.
 *
 * The two actions are the shared `Button`. They were `schools-modal-btn-*`
 * — the Schools modal's buttons, borrowed for a warehouse card — which is
 * how a card came to depend on a screen it has nothing to do with. The
 * Compass took its colour from a literal hex; it now inherits, like every
 * other icon here.
 *
 * ---------------------------------------------------------------------------
 * The stats are the dashboard's own tiles
 * ---------------------------------------------------------------------------
 * `KpiCard`, with the dashboard's labels, captions and icons — not a second
 * set of stat markup that happens to look similar. These four figures come
 * from `/dashboard/summary/?warehouse=`, which is the endpoint behind the
 * dashboard's KPI row, so the same number should not be called "PENDING
 * ORDERS · orders" here and "Pending Shipments · Picked, awaiting despatch"
 * one click away.
 *
 * The counting animation went with them. It was `AnimatedNumber`, used
 * nowhere else in the app, and it made these the only figures in the system
 * that arrive by ticking up — a figure that animates on a screen where
 * nothing else does reads as a widget rather than a fact, and it delays the
 * number a reader came to read.
 */

import { AlertTriangle, Boxes, Clock, Compass, Truck } from 'lucide-react'
import { Badge, Button } from '@/components'
import { formatQuantity } from '@/domain/money'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import type { DashboardSummary, Warehouse } from '@/api/types'

/** A figure that has not arrived reads as a dash, not a zero — as on the
    dashboard, where zero is a real and meaningful answer. */
function figure(value: number | undefined, loading: boolean): string {
  if (loading || value === undefined) return '—'
  return formatQuantity(value)
}

interface WarehouseCardProps {
  warehouse: Warehouse
  summary: DashboardSummary | null
  loading: boolean
  onViewDashboard: () => void
  onViewInventory: () => void
}

export function WarehouseCard({
  warehouse,
  summary,
  loading,
  onViewDashboard,
  onViewInventory,
}: WarehouseCardProps) {
  const availableUnits = summary?.available_units
  const pendingOrders = summary?.orders_awaiting_dispatch
  const backorders = summary?.outstanding_backorders
  const lowStockSkus = summary?.skus_below_minimum

  return (
    <div className="site-card">
      <div className="site-card__top">
        <div>
          <h2 className="site-card__title">{warehouse.name}</h2>
          {warehouse.address && <p className="site-card__address">{warehouse.address}</p>}
        </div>
        <Badge tone={warehouse.is_active ? 'success' : 'neutral'}>
          {warehouse.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <p className="site-card__meta-line">
        <Compass size={15} aria-hidden />
        Primary Tailoring: <strong>{warehouse.primary_tailoring_center_name || 'Not set'}</strong>
      </p>

      <div className="site-card__stats">
        <KpiCard
          label="Available Stock"
          value={figure(availableUnits, loading)}
          caption="Items ready in bins"
          icon={Boxes}
        />
        <KpiCard
          label="Pending Shipments"
          value={figure(pendingOrders, loading)}
          caption="Picked, awaiting despatch"
          icon={Truck}
        />
        <KpiCard
          label="Backorders"
          value={figure(backorders, loading)}
          caption="Outstanding lines"
          icon={Clock}
        />
        <KpiCard
          label="Low Stock"
          value={
            loading || lowStockSkus === undefined
              ? '—'
              : `${formatQuantity(lowStockSkus)} SKU${lowStockSkus === 1 ? '' : 's'}`
          }
          caption="At or below minimum"
          icon={AlertTriangle}
          /* This card is one warehouse, so the count is SKUs at this site —
             never the all-sites "alerts" wording the dashboard switches to. */
          tone={lowStockSkus ? 'alert' : 'default'}
        />
      </div>

      <div className="site-card__actions">
        <Button onClick={onViewDashboard} full>
          View Dashboard
        </Button>
        <Button variant="secondary" onClick={onViewInventory} full>
          View Inventory
        </Button>
      </div>
    </div>
  )
}
