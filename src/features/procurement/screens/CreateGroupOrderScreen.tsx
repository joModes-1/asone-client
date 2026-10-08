/**
 * Create Group Order.
 *
 * A page, not a dialog, for the same reason `CreateProductionOrderScreen` is:
 * an unbounded line table on a document that routinely carries dozens of
 * SKUs. A modal makes that scroll inside a box and puts twenty minutes of
 * keying one stray click from being lost.
 *
 * ---------------------------------------------------------------------------
 * The one real difference from a production order
 * ---------------------------------------------------------------------------
 * **No agreed price column.** A production order records what was negotiated
 * with a particular centre, so a typed price is kept and a blank falls back to
 * the list. A group order is the requirement itself — raised *before* the
 * centres are asked for anything — so there is nothing yet to negotiate with.
 * The server prices every line from the list in force on the order date.
 *
 * That makes an unpriced garment fatal rather than correctable here: there is
 * no box to type a price into. The server refuses the whole order and names
 * the garment, so the form blocks it first and names it too — finding out
 * after forty lines are typed is the outcome worth avoiding.
 *
 * Three other rules the server enforces, caught here so a 400 never lands on
 * a finished form:
 *
 *   **A SKU may appear once.** Chosen SKUs drop out of the picker.
 *   **Quantities are whole numbers, at least one.** These controls are not in
 *   a `<form>` and submit is a click, so `min` and `step` never fire.
 *   **Due cannot precede the order date.** `min` on a date input constrains
 *   the picker, not a typed value or one already in state.
 *
 * Incomplete rows are blocked rather than silently dropped. Posting forty of
 * forty-one lines and reporting success is worse than refusing: the shortfall
 * surfaces months later as a production order nobody can reconcile.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button, LoadingScreen } from '@/components'
import { isBefore, todayISO } from '@/domain/dates'
import { formatUGX, multiplyMoney, sumLineTotals } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { useCreateGroupOrder, useOrderableSkus } from '../hooks/useGroupOrders'
import type { Sku } from '@/api/types'

interface DraftLine {
  /** Local key: a row is identified by this, never by its SKU, which changes. */
  key: number
  sku: number | null
  quantity: number
}

let nextKey = 1

function blankLine(): DraftLine {
  nextKey += 1
  return { key: nextKey, sku: null, quantity: 1 }
}

export function CreateGroupOrderScreen() {
  const navigate = useNavigate()

  const skusQuery = useOrderableSkus()
  const create = useCreateGroupOrder()

  const skus = useMemo(() => skusQuery.data?.results ?? [], [skusQuery.data])
  const submitting = create.isPending

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

  /*
   * A garment with no price on file. Fatal here, unlike on a production
   * order, because this form has no price column to override it with.
   */
  const unpriced = lines.filter((line) => {
    const sku = skuOf(line.sku)
    return sku && !sku.unit_price
  })

  const ready =
    orderDate !== '' &&
    lines.length > 0 &&
    incompleteLines.length === 0 &&
    unpriced.length === 0 &&
    !dueTooEarly

  const totalUnits = lines.reduce((sum, line) => sum + (line.sku ? line.quantity : 0), 0)

  /**
   * What the season commits to, at today's list prices.
   *
   * An estimate, and labelled as one: the server prices each line from the
   * list in force on the order date, which may not be today. Summed in
   * integer minor units — money is never added with `+` in this system.
   */
  const estimate = sumLineTotals(
    lines.flatMap((line) => {
      const sku = skuOf(line.sku)
      if (!sku || !sku.unit_price) return []
      return [{ unit: sku.unit_price, quantity: line.quantity }]
    }),
  )

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((prior) => prior.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function submit() {
    if (!ready) return

    create.mutate(
      {
        order_date: orderDate,
        due_in_warehouse_date: dueDate || null,
        notes: notes.trim() || undefined,
        lines: lines.map((line) => ({
          sku: line.sku as number,
          quantity: line.quantity,
        })),
      },
      {
        // Straight to the order just raised: the reader wants to see what
        // they made — and the reconciliation on it — not hunt for it.
        onSuccess: (order) => navigate(`/group-orders/${order.id}`),
      },
    )
  }

  if (skusQuery.isLoading) return <LoadingScreen message="Loading the catalogue" />

  return (
    <AppShell title="Group orders">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/group-orders">Group Orders</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">New order</span>
      </nav>

      <header className="page-head">
        <h1 className="page-head__title">Create Group Order</h1>
        <p className="page-head__subtitle">
          The season&rsquo;s whole requirement, before it is split between the
          Tailoring Centers.
        </p>
      </header>

      <div className="compose">
        <section className="card-panel compose__details">
          <h2 className="card-panel__title card-panel__title--accent">Order Details</h2>

          <div className="field field--stacked">
            <label htmlFor="go-date">Order Date</label>
            <input
              id="go-date"
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
            <label htmlFor="go-due">Required In Warehouse</label>
            <input
              id="go-due"
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
            <label htmlFor="go-notes">Notes</label>
            <textarea
              id="go-notes"
              className="input input--area"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What this requirement covers — the season, the schools, anything the centres should know."
            />
          </div>
        </section>

        <section className="card-panel compose__lines">
          <div className="card-panel__head">
            <h2 className="card-panel__title card-panel__title--accent">
              Garments Required
            </h2>
            <Button size="sm" onClick={() => setLines((prior) => [...prior, blankLine()])}>
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
                  <th className="ledger__num">List Price</th>
                  <th className="ledger__num">Line Total</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const sku = skuOf(line.sku)
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
                        {sku && <p className="line-note">{sku.number}</p>}
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
                              // Rounded, not just clamped: "5.5" would post a
                              // fractional garment count.
                              quantity: Math.max(1, Math.round(Number(event.target.value) || 1)),
                            })
                          }
                        />
                      </td>

                      <td className="ledger__num t-numeric">
                        {sku
                          ? sku.unit_price
                            ? formatUGX(sku.unit_price)
                            : 'no price on file'
                          : '—'}
                      </td>

                      <td className="ledger__num t-numeric">
                        {sku && sku.unit_price
                          ? formatUGX(multiplyMoney(sku.unit_price, line.quantity))
                          : '—'}
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
            <p className="callout callout--warning">
              <AlertTriangle size={16} aria-hidden />
              {incompleteLines.length === 1
                ? 'One row has no garment chosen. Pick one, or remove the row.'
                : `${incompleteLines.length} rows have no garment chosen. Pick them, or remove the rows.`}
            </p>
          )}

          {unpriced.length > 0 && (
            /*
              Named, not counted. Unlike a production order there is no price
              box to fix it in, so the only action is to go and price the
              garment — which means the reader needs to know which one.
            */
            <p className="callout callout--warning">
              <AlertTriangle size={16} aria-hidden />
              No price on file for{' '}
              {unpriced
                .map((line) => skuOf(line.sku)?.number)
                .filter(Boolean)
                .join(', ')}
              . A group order is priced from the list, so these must be priced
              on Inventory → Garments first. The server refuses the whole order
              otherwise.
            </p>
          )}

          <p className="field__hint">
            Every line is priced from the list in force on the order date.
            Unlike a production order there is no negotiated price here — the
            centres have not been asked yet.
          </p>
        </section>
      </div>

      {/*
        A bar at the foot of the page rather than buttons trailing the table:
        with forty lines on screen the actions would otherwise sit wherever
        the table happened to end.
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
            onClick={() => navigate('/group-orders')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button disabled={!ready || submitting} onClick={submit}>
            {submitting ? 'Creating…' : 'Create Group Order'}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
