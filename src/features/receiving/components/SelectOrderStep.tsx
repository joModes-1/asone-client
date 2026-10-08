/**
 * Step 1 — which delivery is this, and what was it meant to contain.
 *
 * Two panels: the paperwork that came with the van on the left, and what the
 * order still expects on the right, so a clerk can see before keying
 * anything whether the van looks like the right van.
 *
 * The preview is `outstanding`, not the order's original lines. A Tailoring
 * Center delivering 500 shirts in two vans produces two receipts, and the
 * second one should expect what is left — not the whole order again.
 */

import { Boxes, PackageOpen } from 'lucide-react'
import { Button, EmptyState, Panel, SkeletonRows } from '@/components'
import { formatQuantity } from '@/domain/money'
import { todayISO } from '@/domain/dates'
import type { OutstandingRow, ProductionOrder } from '@/api/types'

interface SelectOrderStepProps {
  orders: ProductionOrder[]
  ordersLoading: boolean
  orderId: number | null
  onOrderChange: (id: number | null) => void
  packingListNumber: string
  dateReceived: string
  onDateReceivedChange: (value: string) => void
  onPackingListNumberChange: (value: string) => void
  carrierName: string
  onCarrierNameChange: (value: string) => void
  expected: OutstandingRow[]
  expectedLoading: boolean
  onContinue: () => void
}

export function SelectOrderStep({
  orders,
  ordersLoading,
  orderId,
  onOrderChange,
  packingListNumber,
  dateReceived,
  onDateReceivedChange,
  onPackingListNumberChange,
  carrierName,
  onCarrierNameChange,
  expected,
  expectedLoading,
  onContinue,
}: SelectOrderStepProps) {
  // The packing list number is the one thing that cannot be reconstructed
  // later: it is handwritten on paper that goes back with the driver.
  const ready =
    orderId !== null &&
    packingListNumber.trim().length > 0 &&
    dateReceived !== '' &&
    expected.length > 0

  if (!ordersLoading && orders.length === 0) {
    return (
      <EmptyState
        title="No deliveries expected"
        body="Receiving works against an open production order. When Central Office raises one for this warehouse, it appears here."
        icon={Boxes}
      />
    )
  }

  return (
    <div className="receiving__columns">
      <section className="card-panel">
        <h2 className="card-panel__title">Shipment Details</h2>

        <div className="field field--stacked">
          <label htmlFor="receiving-order">Select Production Order</label>
          <select
            id="receiving-order"
            className="input"
            value={orderId ?? ''}
            disabled={ordersLoading}
            onChange={(event) =>
              onOrderChange(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">
              {ordersLoading ? 'Loading orders…' : 'Choose the order this is against…'}
            </option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.number} — {order.tailoring_center_name}
              </option>
            ))}
          </select>
        </div>

        <div className="field field--stacked">
          <label htmlFor="receiving-packing-list">Packing List Number</label>
          <input
            id="receiving-packing-list"
            className="input"
            value={packingListNumber}
            onChange={(event) => onPackingListNumberChange(event.target.value)}
            placeholder="PL-99201-IDUDI"
          />
          <p className="field__hint">
            Enter the physical list ID sent with the transport vehicle.
          </p>
        </div>

        {/*
          Asked for, not assumed.
          
          This was hard-coded to today, so a delivery keyed in on Monday for
          a van that arrived on Friday was recorded as Monday's. The stock
          movement takes its date from here, and the ledger is append-only —
          a wrong date cannot be edited out afterwards, only offset by
          another entry.
          
          It matters most right now: AsOne have 2027 production already in
          flight with the TCs, so the first receipts keyed in will be for
          deliveries that happened before go-live.
          
          The server refuses a date earlier than the order itself, which is
          the one direction that cannot be true.
        */}
        <div className="field field--stacked">
          <label htmlFor="receiving-date">Date Received</label>
          <input
            id="receiving-date"
            type="date"
            className="input"
            value={dateReceived}
            max={todayISO()}
            onChange={(event) => onDateReceivedChange(event.target.value)}
          />
          <p className="field__hint">
            When the van actually arrived, which may not be today. Stock is
            recorded against this date.
          </p>
        </div>

        <div className="field field--stacked">
          <label htmlFor="receiving-carrier">Carrier / Driver Name</label>
          <input
            id="receiving-carrier"
            className="input"
            value={carrierName}
            onChange={(event) => onCarrierNameChange(event.target.value)}
            placeholder="Who delivered it"
          />
        </div>

        <Button size="lg" full disabled={!ready} onClick={onContinue}>
          Save &amp; Continue to Compare
        </Button>
      </section>

      <Panel
        title="Expected Inventory preview"
        meta={
          expected.length > 0 ? (
            <span className="pill pill--mint">
              {expected.length} ITEM{expected.length === 1 ? '' : 'S'} ASSOCIATED
            </span>
          ) : undefined
        }
      >
        {expectedLoading ? (
          <SkeletonRows rows={5} />
        ) : orderId === null ? (
          <p className="panel__clear">
            <PackageOpen size={18} aria-hidden />
            Choose a production order to see what it expects.
          </p>
        ) : expected.length === 0 ? (
          <p className="panel__clear">
            Everything on this order has already been received.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="ledger">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Description</th>
                  <th>Size</th>
                  <th className="ledger__num">Expected Qty</th>
                </tr>
              </thead>
              <tbody>
                {expected.map((row) => (
                  <tr key={row.sku}>
                    <td className="ledger__code">{row.sku_number}</td>
                    <td className="ledger__wrap">{row.sku_description}</td>
                    <td>{row.sku_size}</td>
                    <td className="ledger__num">
                      {formatQuantity(row.outstanding)} pcs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
