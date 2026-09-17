/**
 * A warehouse's hub console — reached from the Warehouses list's "View
 * Dashboard", not the sidebar.
 *
 * Every figure and every row here is real, from the same endpoints the rest
 * of the app already reads — see `useWarehouseHub`. The design's caption for
 * Backorders ("Awaiting TC completion") is not accurate to what
 * `outstanding_backorders` counts — a backorder is filled from *any*
 * warehouse's stock, not gated on a Tailoring Center — so that tile's
 * caption is rewritten to what the figure actually means rather than copied
 * verbatim. Likewise "Shipped Today" is captioned as leaving the warehouse,
 * not as delivered: `Shipment.shipped_on` is when the van left, and whether
 * it arrived is a separate, later fact (`received_at`).
 */

import { Link, useParams } from 'react-router-dom'
import { LoadingScreen } from '@/components'
import { AppShell } from '@/features/shell/components/AppShell'
import { paths } from '@/routes/paths'
import {
  DispatchLogPanel,
  IncomingProductionPanel,
  LowStockAlertsPanel,
  PickingQueuePanel,
} from '../components/WarehouseHubPanels'
import { useWarehouseHub } from '../hooks/useWarehouseHub'
import { Boxes, ClipboardList, Clock, Truck } from 'lucide-react'
import { KpiCard } from '@/features/dashboard/components/KpiCard'

/** A figure that has not arrived reads as a dash, not a zero — zero is a
 * real, meaningful answer here, same as the rest of the dashboard. */
function figure(value: number | undefined, loading: boolean): string {
  if (loading || value === undefined) return '—'
  return value.toLocaleString()
}

export function WarehouseDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const warehouseId = Number(id)

  const {
    warehouse,
    warehouseLoading,
    summary,
    summaryLoading,
    incomingProduction,
    incomingProductionTotal,
    incomingProductionLoading,
    lowStockAlerts,
    lowStockAlertsLoading,
    pickingQueue,
    pickingQueueTotal,
    pickingQueueLoading,
    dispatchLog,
    dispatchLogTotal,
    dispatchLogLoading,
  } = useWarehouseHub(warehouseId)

  if (warehouseLoading) return <LoadingScreen message="Loading warehouse…" />
  if (!warehouse) return <LoadingScreen message="Warehouse not found." />

  return (
    <AppShell title={`${warehouse.name} Hub Console`}>
      <header className="page-head">
        <p className="page-head__eyebrow">
          <Link to={paths.warehouses}>
            WAREHOUSES
          </Link>{' '}
          / {warehouse.name.toUpperCase()} HUB
        </p>
        <h1 className="page-head__title">{warehouse.name} Hub Console</h1>
        <p className="page-head__subtitle">
          Detailed stock levels, upcoming production runs, and lakeside distribution logs.
        </p>
      </header>

      {/*
        The dashboard's `KpiCard`, like every other set of figures in the
        app. These were `hub-kpi-card` — label, then figure, then caption,
        and no icon — a third tile shape for the same kind of fact.
      */}
      <div className="kpi-row">
        <KpiCard
          label="Available Stock"
          value={figure(summary?.available_units, summaryLoading)}
          caption="Units in local bins"
          icon={Boxes}
        />
        <KpiCard
          label="In Picking Queue"
          value={figure(summary?.units_awaiting_pick, summaryLoading)}
          caption="Pending packaging"
          icon={ClipboardList}
        />
        <KpiCard
          label="Shipped Today"
          value={figure(summary?.units_shipped_today, summaryLoading)}
          caption="Left the warehouse today"
          icon={Truck}
        />
        <KpiCard
          label="Backorders"
          value={figure(summary?.outstanding_backorders, summaryLoading)}
          caption="Open or assigned, not yet shipped"
          icon={Clock}
          tone={summary?.outstanding_backorders ? 'alert' : 'default'}
        />
      </div>

      <div className="hub-grid-2x2">
        <IncomingProductionPanel
          orders={incomingProduction}
          total={incomingProductionTotal}
          loading={incomingProductionLoading}
        />
        <LowStockAlertsPanel alerts={lowStockAlerts} loading={lowStockAlertsLoading} />
        <PickingQueuePanel
          orders={pickingQueue}
          total={pickingQueueTotal}
          loading={pickingQueueLoading}
        />
        <DispatchLogPanel
          shipments={dispatchLog}
          total={dispatchLogTotal}
          loading={dispatchLogLoading}
        />
      </div>
    </AppShell>
  )
}
