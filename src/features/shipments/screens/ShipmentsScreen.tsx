/**
 * Shipments — F41, F42.
 *
 * What has left the warehouses, newest first, with the design's filter band
 * and numbered pagination.
 *
 * The design's four statuses are two. A shipment row does not exist until
 * despatch creates it, so nothing is ever "Preparing" or "Ready" — before
 * despatch there are only orders waiting to be picked, which is the despatch
 * queue below, a different table. See `domain/shipping.ts`.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Truck } from 'lucide-react'
import { Badge, EmptyState, Pagination, SkeletonRows, TabBar } from '@/components'
import { todayISO } from '@/domain/dates'
import { formatQuantity } from '@/domain/money'
import { daysInTransit, shipmentLabel, shipmentTone } from '@/domain/shipping'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { seesAllLocations } from '@/domain/access'
import { AppShell } from '@/features/shell/components/AppShell'
import { useSchools } from '@/features/shipments/hooks/useSchoolOptions'
import { useWarehouseOptions } from '@/features/shipments/hooks/useSchoolOptions'
import { ShipmentFilterBar } from '../components/ShipmentFilterBar'
import { SHIPMENTS_PAGE_SIZE, useShipments } from '../hooks/useShipments'
import type { ShipmentFilters } from '@/api/shipments'

function formatDate(value: string): string {
  // Split rather than `new Date(iso)`, which reads a YYYY-MM-DD as UTC
  // midnight and prints a day early west of Greenwich.
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const NO_FILTERS: ShipmentFilters = {}

export function ShipmentsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ShipmentFilters>(NO_FILTERS)

  const canPickWarehouse = seesAllLocations(user)
  const shipments = useShipments(page, filters)
  const schools = useSchools()
  const warehouses = useWarehouseOptions(canPickWarehouse)

  const today = useMemo(() => todayISO(), [])
  const rows = shipments.data?.results ?? []
  const total = shipments.data?.count ?? 0
  const filtered = Object.values(filters).some((v) => v !== undefined && v !== '')

  function changeFilters(next: ShipmentFilters) {
    setFilters(next)
    // A filter changes what page 1 means; staying on page 4 of the old set
    // shows an empty table.
    setPage(1)
  }

  return (
    <AppShell title="Shipping">
      <header className="page-head">
        <h1 className="page-head__title">Shipping</h1>
        <p className="page-head__subtitle">
          {/*
            Says where the *verb* is. "Despatch" and "Despatched" are one
            letter apart, so looking for the action on the past-tense tab is
            the obvious thing to do — and this tab is a read-only archive,
            which leaves somebody who came here to send a van with nothing to
            click and no idea why.
          */}
          What has left the warehouses, and what the schools have confirmed. To
          send a van, use <Link to="/shipments">To Pick</Link> — vans are loaded
          from there, not here.
        </p>
      </header>

      <TabBar
        label="Shipping views"
        active="history"
        onSelect={(key) => key === 'picking' && navigate('/shipments')}
        tabs={[
          { key: 'picking', label: 'To Pick' },
          { key: 'history', label: 'Despatched' },
        ]}
      />

      <ShipmentFilterBar
        value={filters}
        onChange={changeFilters}
        schools={schools.data?.results ?? []}
        warehouses={warehouses.data?.results ?? []}
        canPickWarehouse={canPickWarehouse}
      />

      <div className="table-card">
        {shipments.isLoading ? (
          <SkeletonRows rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={filtered ? 'No shipments match these filters' : 'Nothing has shipped yet'}
            body={
              filtered
                ? 'Widen the filters, or clear them to see everything that has gone out.'
                : 'A shipment appears here the moment a warehouse despatches picked orders to a school.'
            }
            icon={Truck}
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="ledger ledger--production">
                <thead>
                  <tr>
                    <th>Shipment ID</th>
                    <th>Destination School</th>
                    <th className="ledger__num">Orders</th>
                    <th className="ledger__num">Total Items</th>
                    <th>Ship Date</th>
                    <th>Source Warehouse</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((shipment) => {
                    const out = daysInTransit(shipment.shipped_on, today)
                    const chasing = shipment.status === 'SHIPPED' && out > 14

                    return (
                      <tr
                        key={shipment.id}
                        className="ledger__row--clickable"
                        onClick={() => navigate(`/shipments/${shipment.id}`)}
                      >
                        <td>
                          <a
                            className="ledger__link"
                            href={`/shipments/${shipment.id}`}
                            onClick={(event) => {
                              // The row handler navigates; let modified
                              // clicks fall through to the browser.
                              if (!event.metaKey && !event.ctrlKey) event.preventDefault()
                            }}
                          >
                            {shipment.number}
                          </a>
                        </td>
                        <td className="ledger__strong">{shipment.school_name}</td>
                        <td className="ledger__num">{shipment.order_count}</td>
                        <td className="ledger__num">
                          {formatQuantity(shipment.total_quantity)}
                        </td>
                        <td>{formatDate(shipment.shipped_on)}</td>
                        <td>{shipment.from_warehouse_name}</td>
                        <td>
                          <Badge tone={chasing ? 'warning' : shipmentTone(shipment.status)}>
                            {/*
                              A parcel out for a fortnight is the one worth
                              chasing, and "In transit" alone does not say so.
                            */}
                            {chasing
                              ? `In transit · ${out} days`
                              : shipmentLabel(shipment.status)}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="table-card__footer">
              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(total / SHIPMENTS_PAGE_SIZE))}
                totalItems={total}
                pageSize={SHIPMENTS_PAGE_SIZE}
                onChange={setPage}
                noun="shipments"
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
