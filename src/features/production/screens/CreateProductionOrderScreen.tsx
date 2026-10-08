/**
 * Create Production Order — F17.
 *
 * A page, not a dialog. This is not a short form: five header fields and an
 * unbounded line table with three inputs a row, on orders that routinely
 * carry six to ten SKUs. A modal makes a table like that scroll inside a box
 * and puts twenty minutes of keying one stray click from being lost.
 *
 * Its own route rather than a flag on the list screen, so Back works, the
 * URL can be shared, and leaving does not remount the queue behind it.
 *
 * Four things the form has to get right, because the server refuses
 * otherwise and a 400 after the whole order is typed is the worst outcome:
 *
 *   **A SKU may appear once.** Chosen SKUs drop out of the picker rather
 *   than being caught on submit.
 *   **Quantities are whole numbers, at least one.** These controls are not
 *   in a `<form>` and submit is a click, so `min` and `step` are never
 *   enforced by the browser — the rounding is done here.
 *   **Due cannot precede the order date.** Same reason: `min` on a date
 *   input constrains the picker, not a typed value or one already in state.
 *   **Every line must be priceable.** Blank copies the garment's price on
 *   the order date; a SKU with no price on that date and none typed is
 *   refused there, so it is blocked here.
 *
 * Incomplete rows are blocked rather than silently dropped. Posting four of
 * five lines and reporting success is worse than refusing: nobody finds out
 * until the delivery is short.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button, LoadingScreen } from '@/components'
import { isBefore, todayISO } from '@/domain/dates'
import { formatUGX, multiplyMoney, sumLineTotals } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import {
  useCreateProductionOrder,
  useOrderableSkus,
  useTailoringCenters,
  useWarehouses,
} from '../hooks/useProductionOrders'
import type { Sku } from '@/api/types'

interface DraftLine {
  /** Local key: a row is identified by this, never by its SKU, which changes. */
  key: number
  sku: number | null
  quantity: number
  unitPrice: string
}

let nextKey = 1

function blankLine(): DraftLine {
  nextKey += 1
  return { key: nextKey, sku: null, quantity: 1, unitPrice: '' }
}

export function CreateProductionOrderScreen() {
  const navigate = useNavigate()

  const centersQuery = useTailoringCenters()
  const warehousesQuery = useWarehouses()
  const skusQuery = useOrderableSkus()
  const create = useCreateProductionOrder()

  const centers = centersQuery.data?.results ?? []
  const warehouses = warehousesQuery.data?.results ?? []
  const skus = useMemo(() => skusQuery.data ?? [], [skusQuery.data])
  const submitting = create.isPending

  const [center, setCenter] = useState<number | null>(null)
  const [warehouse, setWarehouse] = useState<number | null>(null)
  const [orderDate, setOrderDate] = useState(todayISO)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  // Lazy: the eager form runs blankLine() on every render and throws the
  // result away, bumping the key counter for nothing.
  const [lines, setLines] = useState<DraftLine[]>(() => [blankLine()])

  const chosen = useMemo(
    () => new Set(lines.map((line) => line.sku).filter((id): id is number => id !== null)),
    [lines],
  )

  function skuOf(id: number | null): Sku | undefined {
    return skus.find((entry) => entry.id === id)
  }

  const incompleteLines = lines.filter((line) => line.sku === null)
  const dueTooEarly = isBefore(dueDate, orderDate)

  const unpriced = lines.filter((line) => {
    const sku = skuOf(line.sku)
    return sku && !line.unitPrice.trim() && !sku.unit_price
  })

  const ready =
    center !== null &&
    warehouse !== null &&
    orderDate !== '' &&
    lines.length > 0 &&
    incompleteLines.length === 0 &&
    // A line the server cannot cost is a 400 after the whole order is
    // typed, so it is caught here instead.
    unpriced.length === 0 &&
    !dueTooEarly

  const totalUnits = lines.reduce((sum, line) => sum + (line.sku ? line.quantity : 0), 0)

  /**
   * What this order commits AsOne to, at the prices on screen.
   *
   * An estimate, and labelled as one: the server prices each line from the
   * list in force on the order date. Summed in integer minor units — money
   * is never added with `+` in this system.
   */
  const estimate = sumLineTotals(
    lines.flatMap((line) => {
      const sku = skuOf(line.sku)
      const unit = line.unitPrice.trim() || sku?.unit_price
      if (!sku || !unit) return []
      return [{ unit, quantity: line.quantity }]
    }),
  )

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((prior) => prior.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function submit() {
    if (!ready || center === null || warehouse === null) return

    create.mutate(
      {
        tailoring_center: center,
        warehouse,
        order_date: orderDate,
        due_in_warehouse_date: dueDate || null,
        notes: notes.trim() || undefined,
        lines: lines.map((line) => ({
          sku: line.sku as number,
          quantity: line.quantity,
          // Blank means "use the price list on the order date". An empty
          // string is a decimal the server cannot parse.
          ...(line.unitPrice.trim() ? { unit_price: line.unitPrice.trim() } : {}),
        })),
      },
      {
        // Straight to the order just raised: the reader wants to see what
        // they made, not hunt for it in a list.
        onSuccess: (order) => navigate(`/production-orders/${order.id}`),
      },
    )
  }

  if (skusQuery.isLoading) return <LoadingScreen message="Loading the catalogue" />

  return (
    <AppShell title="Production orders">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/production-orders">Production Orders</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">New order</span>
      </nav>

      <header className="page-head">
        <h1 className="page-head__title">Create Production Order</h1>
        <p className="page-head__subtitle">
          Ask a Tailoring Center to make garments for a warehouse.
        </p>
      </header>

      <div className="compose">
        <section className="card-panel compose__details">
          <h2 className="card-panel__title card-panel__title--accent">Order Details</h2>

          <div className="field field--stacked">
            <label htmlFor="po-center">Tailoring Center</label>
            <select
              id="po-center"
              className="input"
              value={center ?? ''}
              onChange={(event) =>
                setCenter(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Who is making these…</option>
              {centers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field field--stacked">
            <label htmlFor="po-warehouse">Destination Warehouse</label>
            <select
              id="po-warehouse"
              className="input"
              value={warehouse ?? ''}
              onChange={(event) =>
                setWarehouse(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Where it should land…</option>
              {warehouses.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <p className="field__hint">Any centre may supply any warehouse.</p>
          </div>

          <div className="field field--stacked">
            <label htmlFor="po-date">Order Date</label>
            <input
              id="po-date"
              className="input"
              type="date"
              value={orderDate}
              onChange={(event) => setOrderDate(event.target.value)}
            />
            <p className="field__hint">
              Line prices come from the list in force on this date.
            </p>
          </div>

          <div className="field field--stacked">
            <label htmlFor="po-due">Required By</label>
            <input
              id="po-due"
              className="input"
              type="date"
              value={dueDate}
              min={orderDate}
              aria-invalid={dueTooEarly || undefined}
              onChange={(event) => setDueDate(event.target.value)}
            />
            {dueTooEarly && (
              <p className="field-error">
                Goods cannot be due before the order asking for them was placed.
              </p>
            )}
          </div>

          <div className="field field--stacked">
            <label htmlFor="po-notes">Notes</label>
            <textarea
              id="po-notes"
              className="input input--area"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything the centre should know."
            />
          </div>
        </section>

        <section className="card-panel compose__lines">
          <div className="card-panel__head">
            <h2 className="card-panel__title card-panel__title--accent">Garments Ordered</h2>
            <Button
              size="sm"
              onClick={() => setLines((prior) => [...prior, blankLine()])}
            >
              <Plus size={14} aria-hidden />
              Add Garment
            </Button>
          </div>

          <div className="table-scroll">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Garment</th>
                  <th className="ledger__num">Quantity</th>
                  <th className="ledger__num">Agreed Price</th>
                  <th className="ledger__num">Line Total</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const sku = skuOf(line.sku)
                  const unit = line.unitPrice.trim() || sku?.unit_price
                  const label = sku ? sku.number : `line ${index + 1}`

                  return (
                    <tr key={line.key}>
                      <td>
                        <select
                          className="input"
                          /* Named per row: "Quantity, Quantity, Quantity"
                             tells a screen-reader user nothing about which
                             garment they are editing. */
                          aria-label={`Garment for line ${index + 1}`}
                          aria-invalid={line.sku === null || undefined}
                          value={line.sku ?? ''}
                          onChange={(event) =>
                            updateLine(line.key, {
                              sku: event.target.value ? Number(event.target.value) : null,
                            })
                          }
                        >
                          <option value="">Choose a garment…</option>
                          {skus
                            // A SKU may appear once per order.
                            .filter((entry) => entry.id === line.sku || !chosen.has(entry.id))
                            .map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.garment_name} · size {entry.size_name}
                              </option>
                            ))}
                        </select>
                        {sku && (
                          <p className="line-note">
                            {sku.number} · list{' '}
                            {sku.unit_price ? formatUGX(sku.unit_price) : 'no price on file'}
                          </p>
                        )}
                      </td>

                      <td className="ledger__num">
                        <input
                          className="input input--count"
                          type="number"
                          min={1}
                          step={1}
                          aria-label={`Quantity for ${label}`}
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.key, {
                              // Rounded, not just clamped: "5.5" would post
                              // a fractional garment count.
                              quantity: Math.max(
                                1,
                                Math.round(Number(event.target.value) || 1),
                              ),
                            })
                          }
                        />
                      </td>

                      <td className="ledger__num">
                        <input
                          className="input input--count input--price"
                          type="text"
                          inputMode="decimal"
                          aria-label={`Agreed unit price for ${label}`}
                          placeholder="List"
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(line.key, { unitPrice: event.target.value })
                          }
                        />
                      </td>

                      <td className="ledger__num t-numeric">
                        {sku && unit ? formatUGX(multiplyMoney(unit, line.quantity)) : '—'}
                      </td>

                      <td className="ledger__num">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove line ${index + 1}`}
                          disabled={lines.length === 1}
                          onClick={() =>
                            setLines((prior) => prior.filter((entry) => entry.key !== line.key))
                          }
                        >
                          <Trash2 size={16} aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {incompleteLines.length > 0 && (
            /*
              Named rather than dropped. The first version filtered these out
              and posted the rest, so a lead who missed one dropdown got a
              success message for an order short a garment — and found out
              when the delivery was.
            */
            <p className="callout callout--warning">
              <AlertTriangle size={16} aria-hidden />
              {incompleteLines.length === 1
                ? 'One line has no garment chosen. Pick one, or remove the row.'
                : `${incompleteLines.length} lines have no garment chosen. Pick them, or remove the rows.`}
            </p>
          )}

          {unpriced.length > 0 && (
            <p className="callout callout--warning">
              <AlertTriangle size={16} aria-hidden />
              {unpriced.length === 1 ? 'One garment has' : `${unpriced.length} garments have`} no
              price on file. Type the price agreed with the centre, or the order cannot be
              costed.
            </p>
          )}

          <p className="field__hint">
            Leave Agreed Price blank to use the price list in force on the order date. Type one
            to record what was negotiated with the centre.
          </p>
        </section>
      </div>

      {/*
        A bar at the foot of the page rather than buttons trailing the table:
        with ten lines on screen the actions would otherwise sit wherever the
        table happened to end.
      */}
      <div className="compose__bar">
        <div className="compose__summary">
          <p className="compose__count">
            {totalUnits > 0
              ? `${totalUnits} units across ${lines.length} line${lines.length === 1 ? '' : 's'}`
              : 'Add at least one garment.'}
          </p>
          {totalUnits > 0 && (
            <p className="compose__total">
              <span>Estimated value</span>
              <strong className="t-numeric">{formatUGX(estimate)}</strong>
            </p>
          )}
        </div>

        <div className="compose__actions">
          <Button
            variant="secondary"
            onClick={() => navigate('/production-orders')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button disabled={!ready || submitting} onClick={submit}>
            {submitting ? 'Creating…' : 'Create Order'}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
