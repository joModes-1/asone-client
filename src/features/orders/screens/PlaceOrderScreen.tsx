/**
 * Place a student's uniform order — F30, F31, F32, F33.
 *
 * The one thing this system exists for, and the last screen to be built: the
 * whole order lifecycle behind it — release, pick, despatch, backorder — was
 * already working against orders that could only be seeded. The "New Student
 * Order" button on the orders list has pointed at this route for some time
 * and reached nothing.
 *
 * ---------------------------------------------------------------------------
 * A page, not a dialog
 * ---------------------------------------------------------------------------
 * Same reason as the kit and production-order forms: it carries an unbounded
 * line table, and a stray click outside a modal loses the lot.
 *
 * ---------------------------------------------------------------------------
 * Kits and items are both lines, and a kit is not stock
 * ---------------------------------------------------------------------------
 * A school may order a kit, individual garments, or both. A kit is a
 * convenience for *ordering* and nothing else — the server explodes it into
 * its component SKUs on the way in (F33), because a warehouse picks garments
 * and never "a kit". Those components are stored on the order, so editing
 * the kit's contents next term does not rewrite an order already placed.
 *
 * That is why the two tables are kept apart here rather than merged into one
 * list of things: what the school chose and what the warehouse will pick are
 * different lists, and this screen is the first of the two.
 *
 * ---------------------------------------------------------------------------
 * What the school may choose
 * ---------------------------------------------------------------------------
 * Its own level, plus anything marked for both — the same rule as the price
 * list (F29). The server refuses the rest, but a picker that offers
 * something the server will reject is the screen's mistake, not the clerk's.
 * See `usePlaceOrder`.
 *
 * ---------------------------------------------------------------------------
 * The total here is an estimate, and says so
 * ---------------------------------------------------------------------------
 * Lines are costed by the server at the order date, which is a field on this
 * form. The figure shown while typing uses today's prices; if the clerk
 * back-dates the order, the invoice may legitimately differ. Rather than
 * print a number that could be wrong, the total is labelled as an estimate
 * and the invoice — raised the moment the order is placed — is the real one.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Alert, Button, LoadingScreen } from '@/components'
import { toApiError } from '@/api/errors'
import { formatUGX, sumLineTotals } from '@/domain/money'
import { todayISO } from '@/domain/dates'
import { AppShell } from '@/features/shell/components/AppShell'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useOrderableKits, useOrderableSkus, usePlaceOrder } from '../hooks/usePlaceOrder'

interface DraftLine {
  /** Local key: a row is identified by this, never by its choice, which changes. */
  key: number
  /** Kit id or SKU id, depending on which table this row is in. */
  choice: number | null
  quantity: number
}

let nextKey = 1

function blankLine(): DraftLine {
  nextKey += 1
  return { key: nextKey, choice: null, quantity: 1 }
}

export function PlaceOrderScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const school = user?.school ?? null
  const { kits, isLoading: kitsLoading } = useOrderableKits(school?.level)
  const { skus, isLoading: skusLoading } = useOrderableSkus(school?.level)
  const place = usePlaceOrder()

  const [studentName, setStudentName] = useState('')
  const [orderDate, setOrderDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [kitLines, setKitLines] = useState<DraftLine[]>([])
  const [skuLines, setSkuLines] = useState<DraftLine[]>([blankLine()])

  const chosen = useMemo(
    () => [
      ...kitLines
        .filter((line) => line.choice !== null)
        .map((line) => ({
          line,
          price: kits.find((kit) => kit.id === line.choice)?.current_price ?? null,
        })),
      ...skuLines
        .filter((line) => line.choice !== null)
        .map((line) => ({
          line,
          price: skus.find((sku) => sku.id === line.choice)?.unit_price ?? null,
        })),
    ],
    [kitLines, skuLines, kits, skus],
  )

  const unpriced = chosen.filter((entry) => entry.price === null)
  const priced = chosen.filter((entry) => entry.price !== null)
  const estimate = sumLineTotals(
    priced.map((entry) => ({ unit: entry.price as string, quantity: entry.line.quantity })),
  )
  const totalUnits = chosen.reduce((sum, entry) => sum + entry.line.quantity, 0)

  const filledKits = kitLines.filter((line) => line.choice !== null)
  const filledSkus = skuLines.filter((line) => line.choice !== null)
  const incomplete = [...kitLines, ...skuLines].filter((line) => line.choice === null)

  const ready =
    studentName.trim() !== '' &&
    orderDate !== '' &&
    filledKits.length + filledSkus.length > 0 &&
    !place.isPending

  function submit() {
    if (!ready) return

    place.mutate(
      {
        student_name: studentName.trim(),
        order_date: orderDate,
        kits: filledKits.map((line) => ({ kit: line.choice as number, quantity: line.quantity })),
        skus: filledSkus.map((line) => ({ sku: line.choice as number, quantity: line.quantity })),
        notes: notes.trim() || undefined,
      },
      { onSuccess: (order) => navigate(`/orders/${order.id}`) },
    )
  }

  if (kitsLoading || skusLoading) return <LoadingScreen message="Loading the catalogue" />

  /*
   * A school clerk whose account has no school cannot order for anybody.
   * The server says the same thing with a 403; saying it here means they are
   * not left filling in a form that cannot be submitted.
   */
  if (!school) {
    return (
      <AppShell title="New Student Order">
        <Alert tone="error">
          <strong>Your account is not attached to a school.</strong> An order
          belongs to the school that placed it, so one cannot be placed until
          a lead assigns yours.
        </Alert>
      </AppShell>
    )
  }

  return (
    <AppShell title="New Student Order">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/orders">Orders</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">New order</span>
      </nav>

      <header className="page-head">
        <h1 className="page-head__title">New student order</h1>
        <p className="page-head__subtitle">
          For {school.name}. The order is held until Finance confirms payment —
          nothing is reserved in the warehouse before that.
        </p>
      </header>

      {place.isError && (
        <Alert tone="error">
          <strong>The order was not placed.</strong>{' '}
          {toApiError(place.error).message}
        </Alert>
      )}

      <div className="compose compose--even">
        <section className="card-panel compose__details">
          <h2 className="card-panel__title card-panel__title--accent">Order details</h2>

          <div className="field field--stacked">
            <label htmlFor="order-student">Student</label>
            <input
              id="order-student"
              className="input"
              value={studentName}
              placeholder="Nakato Grace"
              onChange={(event) => setStudentName(event.target.value)}
            />
            <p className="field__hint">
              Free text — students have no accounts here. It is how the school
              hands the right uniform to the right child.
            </p>
          </div>

          <div className="field field--stacked">
            <label htmlFor="order-date">Order date</label>
            <input
              id="order-date"
              type="date"
              className="input"
              value={orderDate}
              onChange={(event) => setOrderDate(event.target.value)}
            />
            <p className="field__hint">
              Decides which prices the order is costed at. A price that
              changed since applies from its own date, not today&apos;s.
            </p>
          </div>

          <div className="field field--stacked">
            <label htmlFor="order-notes">Notes</label>
            <input
              id="order-notes"
              className="input"
              value={notes}
              placeholder="Optional"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </section>

        <section className="card-panel compose__lines">
          <h2 className="card-panel__title card-panel__title--accent">What the student needs</h2>

          {/*
            Kits first, because a kit is the quicker way to order a whole
            uniform and most orders start with one. A school with no kits for
            its level sees only the item table rather than an empty picker.
          */}
          {kits.length > 0 && (
            <>
              <h3 className="compose__group-title">Kits</h3>

              {kitLines.length === 0 ? (
                <p className="field__hint">No kit on this order.</p>
              ) : (
                <div className="table-scroll">
                  <table className="ledger">
                    <thead>
                      <tr>
                        <th>Kit</th>
                        <th className="ledger__num">Qty</th>
                        <th className="ledger__num">Each</th>
                        <th aria-label="Remove" />
                      </tr>
                    </thead>
                    <tbody>
                      {kitLines.map((line) => {
                        const kit = kits.find((entry) => entry.id === line.choice) ?? null
                        return (
                          <tr key={line.key}>
                            <td>
                              <select
                                aria-label="Kit"
                                className="input"
                                value={line.choice ?? ''}
                                onChange={(event) =>
                                  setKitLines((current) =>
                                    current.map((row) =>
                                      row.key === line.key
                                        ? { ...row, choice: Number(event.target.value) }
                                        : row,
                                    ),
                                  )
                                }
                              >
                                <option value="" disabled>
                                  Choose a kit…
                                </option>
                                {kits.map((entry) => (
                                  <option key={entry.id} value={entry.id}>
                                    {entry.name} ({entry.item_count} items)
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="ledger__num">
                              <input
                                type="number"
                                min={1}
                                aria-label="Quantity"
                                className="input input--count"
                                value={line.quantity}
                                onChange={(event) =>
                                  setKitLines((current) =>
                                    current.map((row) =>
                                      row.key === line.key
                                        ? { ...row, quantity: Math.max(1, Number(event.target.value)) }
                                        : row,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td className="ledger__num">
                              {kit?.current_price ? formatUGX(kit.current_price) : '—'}
                            </td>
                            <td className="ledger__num">
                              <Button
                                variant="secondary"
                                size="sm"
                                aria-label="Remove this kit"
                                onClick={() =>
                                  setKitLines((current) =>
                                    current.filter((row) => row.key !== line.key),
                                  )
                                }
                              >
                                <Trash2 size={14} aria-hidden />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setKitLines((current) => [...current, blankLine()])}
              >
                <Plus size={14} aria-hidden />
                Add a kit
              </Button>
            </>
          )}

          <h3 className="compose__group-title">Individual items</h3>

          {skuLines.length === 0 ? (
            <p className="field__hint">No individual items on this order.</p>
          ) : (
            <div className="table-scroll">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="ledger__num">Qty</th>
                    <th className="ledger__num">Each</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {skuLines.map((line) => {
                    const sku = skus.find((entry) => entry.id === line.choice) ?? null
                    return (
                      <tr key={line.key}>
                        <td>
                          <select
                            aria-label="Item"
                            className="input"
                            value={line.choice ?? ''}
                            onChange={(event) =>
                              setSkuLines((current) =>
                                current.map((row) =>
                                  row.key === line.key
                                    ? { ...row, choice: Number(event.target.value) }
                                    : row,
                                ),
                              )
                            }
                          >
                            <option value="" disabled>
                              Choose an item…
                            </option>
                            {skus.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.number} — {entry.description}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="ledger__num">
                          <input
                            type="number"
                            min={1}
                            aria-label="Quantity"
                            className="input input--count"
                            value={line.quantity}
                            onChange={(event) =>
                              setSkuLines((current) =>
                                current.map((row) =>
                                  row.key === line.key
                                    ? { ...row, quantity: Math.max(1, Number(event.target.value)) }
                                    : row,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="ledger__num">
                          {sku?.unit_price ? formatUGX(sku.unit_price) : '—'}
                        </td>
                        <td className="ledger__num">
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label="Remove this item"
                            onClick={() =>
                              setSkuLines((current) =>
                                current.filter((row) => row.key !== line.key),
                              )
                            }
                          >
                            <Trash2 size={14} aria-hidden />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSkuLines((current) => [...current, blankLine()])}
          >
            <Plus size={14} aria-hidden />
            Add an item
          </Button>

          {/*
            An unpriced garment is a gap in the price list, not a fault of
            this order — but it will cost nothing on the invoice, so it is
            named here rather than discovered afterwards.
          */}
          {unpriced.length > 0 && (
            <Alert tone="warning">
              <strong>
                {unpriced.length === 1
                  ? 'One thing on this order has no price today.'
                  : `${unpriced.length} things on this order have no price today.`}
              </strong>{' '}
              The order can still be placed, but the estimate below leaves them
              out. A lead sets prices under Pricing.
            </Alert>
          )}
        </section>
      </div>

      <div className="compose__bar">
        <div className="compose__summary">
          {/* Names the step that is actually missing, rather than the first
              rule that happens to fail. */}
          <p className="compose__count">
            {studentName.trim() === ''
              ? 'Who is this order for?'
              : filledKits.length + filledSkus.length === 0
                ? 'Add a kit or an item.'
                : incomplete.length > 0
                  ? 'Every line needs something chosen, or remove it.'
                  : `${totalUnits} on ${filledKits.length + filledSkus.length} line${
                      filledKits.length + filledSkus.length === 1 ? '' : 's'
                    }`}
          </p>
          {priced.length > 0 && (
            <p className="compose__total">
              <span>Estimate at today&apos;s prices</span>
              <strong className="t-numeric">{formatUGX(estimate)}</strong>
            </p>
          )}
        </div>

        <div className="compose__actions">
          <Button
            variant="secondary"
            onClick={() => navigate('/orders')}
            disabled={place.isPending}
          >
            Cancel
          </Button>
          <Button disabled={!ready} onClick={submit}>
            <ShoppingCart size={16} aria-hidden />
            {place.isPending ? 'Placing…' : 'Place order'}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
