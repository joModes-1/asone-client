/**
 * New Inventory Adjustment — F23, F24, F26, F27.
 *
 * The only screen in the system that changes a stock figure with no physical
 * event behind it. Everything else moves stock as a consequence of something
 * that happened — a delivery arrived, an order was picked, a van left. Here
 * somebody simply says the number is wrong, and it is.
 *
 * So the form is built around one idea: **say what will happen before it
 * happens.** The panel prints what the system currently holds, the difference
 * the entry makes, and what the figure will be afterwards, and the warning at
 * the foot names the SKU, the quantity and the warehouse in a sentence. None
 * of that is decoration. Posting cannot be undone — a wrong adjustment is
 * corrected by posting an offsetting one (F28), which leaves both in the
 * audit trail forever.
 *
 * ---------------------------------------------------------------------------
 * Why the five cards do not all do the same thing
 * ---------------------------------------------------------------------------
 *
 *   **Return, Pick Up/Loss, Damaged** are the same document with a different
 *   reason code on it. The card picks the family; the Reason select picks the
 *   code within it, because the codes are a table Central Office grows and
 *   not five strings this screen knows.
 *
 *   **Inventory Correction** is F24 and is not a reason code at all. You give
 *   it the count; the *server* compares that to what it holds and posts the
 *   difference against CORR_UP or CORR_DOWN. The whole point of F24 is that
 *   the person counting does not do the subtraction, so the Required
 *   Adjustment box is read-only and the Reason select is replaced by a line
 *   saying who chooses.
 *
 *   **Warehouse Transfer** is not an adjustment. Different endpoint,
 *   different permission, two ledger rows instead of one. The card is drawn
 *   because the design draws it, and it leads to the transfer form.
 *
 * The direction is never chosen here. A reason code carries INCREASE or
 * DECREASE; whoever posts types a count, not a sign.
 */

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronRight,
  CornerUpLeft,
  Lock,
  MinusCircle,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { Alert, Button, LoadingScreen } from '@/components'
import { toApiError } from '@/api/errors'
import { formatDay, todayISO } from '@/domain/dates'
import {
  ADJUSTMENT_KINDS,
  codesForKind,
  formatSigned,
  type AdjustmentKind,
} from '@/domain/adjustments'
import { formatQuantity, formatUGX, multiplyMoney } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { useSkuOptions } from '@/features/catalog/hooks/useSkuOptions'
import { useWarehouseOptions } from '@/features/catalog/hooks/useWarehouseOptions'
import {
  DraftLeftBehind,
  useCorrectCount,
  usePostAdjustment,
  usePostTransfer,
  useReasonCodes,
  useStockOnHand,
} from '../hooks/useAdjustments'

const ICONS: Record<string, LucideIcon> = {
  CornerUpLeft,
  ArrowLeftRight,
  MinusCircle,
  AlertTriangle,
  SlidersHorizontal,
}

export function NewAdjustmentScreen() {
  const navigate = useNavigate()
  const { warehouseId, siteLabel, canSwitch, options } = useWarehouseFilter()

  /*
   * Opened from a SKU's panel on the inventory screen, which passes the SKU
   * and the warehouse it was looking at — so the form starts on the row the
   * person was already reading rather than empty. Typing them again would be
   * a chance to pick the wrong one.
   *
   * Read once, as the initial value: after that the form is the person's,
   * and a stale URL should not pull a field back.
   */
  const [params] = useSearchParams()
  const skuFromUrl = Number(params.get('sku')) || null
  const warehouseFromUrl = Number(params.get('warehouse')) || null

  const [kind, setKind] = useState<AdjustmentKind>('CORRECTION')
  const [skuId, setSkuId] = useState<number | null>(skuFromUrl)
  const [reasonId, setReasonId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')

  /*
    The date the change actually happened, which is not always today. A count
    sheet comes back from the floor on Friday and gets keyed on Monday, and
    the server compares against what it held *on that date* — so posting it
    as today would reconcile against the wrong figure and value it at the
    wrong price.
  */
  const [occurredOn, setOccurredOn] = useState(todayISO)

  /*
    A warehouse-scoped role has no choice and the topbar filter is the answer.
    A lead or Finance sees every site, so "all" is not a place stock can be
    adjusted at — they pick one here, and the box is only locked once there
    is something to lock it to.
  */
  const [chosenWarehouse, setChosenWarehouse] = useState<number | null>(warehouseFromUrl)
  const warehouse = warehouseId ?? chosenWarehouse

  /* Only asked for on the Warehouse Transfer card — where stock is going. */
  const [destination, setDestination] = useState<number | null>(null)

  const skusQuery = useSkuOptions()
  const { warehouses } = useWarehouseOptions()
  const reasonCodes = useReasonCodes()
  const onHand = useStockOnHand(warehouse)
  const postAdjustment = usePostAdjustment()
  const correctCount = useCorrectCount()
  const postTransfer = usePostTransfer()

  const skus = useMemo(() => skusQuery.data?.results ?? [], [skusQuery.data])
  const codes = useMemo(() => reasonCodes.data?.results ?? [], [reasonCodes.data])
  const reasonOptions = useMemo(() => codesForKind(codes, kind), [codes, kind])

  const sku = skus.find((entry) => entry.id === skuId)

  /*
    The warning names the site, so it needs the chosen one — `siteLabel` says
    "All locations" for a role that has them all, which is precisely the
    sentence nobody should be shown before writing a permanent ledger row.
  */
  const sourceName =
    warehouses.find((entry) => entry.id === warehouse)?.name ?? siteLabel
  const destinationName =
    warehouses.find((entry) => entry.id === destination)?.name ?? 'the destination'

  /**
   * What the system believes is on the shelf.
   *
   * Null, not zero, when it is not known yet: "0 units" is a fact, and
   * printing it while the figures are still loading is the kind of lie this
   * screen exists to prevent.
   */
  const stockRow = useMemo(() => {
    if (!skuId || !warehouse || !onHand.data) return null
    return (
      onHand.data.find(
        (entry) => entry.sku_id === skuId && entry.warehouse_id === warehouse,
      ) ?? null
    )
  }, [onHand.data, skuId, warehouse])

  /** Units that can be picked today. What a decrease comes out of. */
  const available = stockRow?.level ?? (skuId && warehouse && onHand.data ? 0 : null)

  /**
   * Units reserved for an order that has not shipped.
   *
   * Still on the shelf, so whoever is counting counts them. Printing only
   * `available` and asking them to reconcile against it is what made the old
   * count correction invent inventory: count 245, system says 200, post +45
   * for shirts that never existed.
   */
  const reserved = stockRow?.reserved ?? (skuId && warehouse && onHand.data ? 0 : null)

  /** What a physical count should find — and what the server compares to. */
  const systemStock =
    available === null || reserved === null ? null : available + reserved

  const typed = Number(quantity)
  const hasQuantity = quantity.trim() !== '' && Number.isFinite(typed) && typed >= 0

  const reason = codes.find((entry) => entry.id === reasonId)

  /** The signed effect on stock. For a correction, counted minus system. */
  const effect = useMemo(() => {
    if (!hasQuantity) return null
    if (kind === 'CORRECTION') {
      if (systemStock === null) return null
      return Math.round(typed) - systemStock
    }
    // A transfer takes the units off the source. They arrive at the
    // destination at the same value, so nothing is lost — but this figure is
    // about the shelf in front of you, and there they are gone.
    if (kind === 'TRANSFER') return -Math.round(typed)
    if (!reason) return null
    return reason.direction === 'DECREASE' ? -Math.round(typed) : Math.round(typed)
  }, [hasQuantity, kind, reason, systemStock, typed])

  /**
   * What this adjustment is worth, at the price on file.
   *
   * An estimate, and said to be one: the server prices it again from the
   * list in force on the date of change, which may not be the list showing
   * here. Summed through `multiplyMoney` — money is never multiplied with
   * `*` in this system.
   */
  const estimate =
    sku?.unit_price && effect !== null && effect !== 0
      ? formatUGX(multiplyMoney(sku.unit_price, Math.abs(effect)))
      : null

  /*
    A decrease is posted against AVAILABLE, so it is the available pool that
    has to cover it — not the total on the shelf. Taking units out of stock
    somebody has already reserved is a pick that can no longer be filled,
    which the server refuses, and rightly.
  */
  const availableAfter =
    available === null || effect === null ? null : available + effect

  // The server refuses a decrease the shelf cannot cover, and a 400 after the
  // whole entry is typed is the worst outcome. Caught here instead.
  const overdrawn = availableAfter !== null && availableAfter < 0

  const pending =
    postAdjustment.isPending || correctCount.isPending || postTransfer.isPending
  const failure = postAdjustment.error ?? correctCount.error ?? postTransfer.error

  const sameSite = kind === 'TRANSFER' && destination !== null && destination === warehouse

  /*
    Stock leaving for a reason nobody wrote down.

    A return has a student behind it and a correction has a count sheet; a
    loss and a write-off have neither. The reason code says "Damaged", which
    is a category, not an account of what happened — and AsOne have not
    settled what a damage does to anyone's books (their question Q6), so this
    sentence is the only record there will be. Required, not merely invited.
  */
  const needsNote = kind === 'LOSS' || kind === 'DAMAGED'
  const noteMissing = needsNote && notes.trim().length < 10

  const ready =
    warehouse !== null &&
    skuId !== null &&
    hasQuantity &&
    !overdrawn &&
    !pending &&
    // Each card asks for one more thing before it can post: a transfer needs
    // somewhere to go, the three coded kinds need a code, and a correction
    // needs the count to actually differ.
    !noteMissing &&
    (kind === 'TRANSFER'
      ? destination !== null && !sameSite && Math.round(typed) > 0
      : kind === 'CORRECTION'
        ? effect !== 0
        : reasonId !== null)

  function submit() {
    if (!ready || warehouse === null || skuId === null) return

    const common = {
      warehouse,
      sku: skuId,
      adjustment_date: occurredOn,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }

    if (kind === 'CORRECTION') {
      correctCount.mutate(
        { ...common, counted_quantity: Math.round(typed) },
        { onSuccess: () => navigate('/adjustments') },
      )
      return
    }

    /*
      A different document under the same card — /inventory/transfers/, two
      ledger rows, and a permission both leads hold. One line, because this
      form has one SKU field; the full transfer form takes many.
    */
    if (kind === 'TRANSFER') {
      if (destination === null) return
      postTransfer.mutate(
        {
          from_warehouse: warehouse,
          to_warehouse: destination,
          transfer_date: occurredOn,
          ...(reasonId ? { reason_code: reasonId } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          lines: [{ sku: skuId, quantity: Math.round(typed) }],
        },
        { onSuccess: () => navigate('/transfers') },
      )
      return
    }

    postAdjustment.mutate(
      { ...common, quantity: Math.round(typed), reason_code: reasonId as number },
      { onSuccess: () => navigate('/adjustments') },
    )
  }

  if (skusQuery.isLoading || reasonCodes.isLoading) {
    return <LoadingScreen message="Loading the catalogue" />
  }

  return (
    <AppShell title="Inventory Adjustments">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/adjustments">Inventory Adjustments</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">
          {kind === 'TRANSFER' ? 'New Transfer' : 'New Adjustment'}
        </span>
      </nav>

      <header className="page-head">
        <h1 className="page-head__title">
          {kind === 'TRANSFER' ? 'New Warehouse Transfer' : 'New Inventory Adjustment'}
        </h1>
        <p className="page-head__subtitle">
          {kind === 'TRANSFER'
            ? 'Posting writes two permanent ledger rows — one out, one in. It cannot be edited or deleted.'
            : 'Posting writes a permanent ledger row. It cannot be edited or deleted — a mistake is corrected by posting the opposite entry.'}
        </p>
      </header>

      <section className="card-panel">
        <h2 className="card-panel__title card-panel__title--accent">Adjustment Type</h2>

        <div className="kind-grid" role="radiogroup" aria-label="Adjustment type">
          {ADJUSTMENT_KINDS.map((info, index) => {
            const Icon = ICONS[info.icon] ?? SlidersHorizontal
            const active = info.kind === kind

            return (
              <button
                key={info.kind}
                type="button"
                role="radio"
                aria-checked={active}
                /*
                  One stop for the whole group, as a radio group should be:
                  Tab reaches the chosen card, arrows move between them. Five
                  tab stops in a row is how a keyboard user ends up pressing
                  Tab twenty times to reach the quantity field.
                */
                tabIndex={active ? 0 : -1}
                className={`kind-card${active ? ' kind-card--active' : ''}`}
                onKeyDown={(event) => {
                  const step =
                    event.key === 'ArrowRight' || event.key === 'ArrowDown'
                      ? 1
                      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                        ? -1
                        : 0
                  if (step === 0) return
                  event.preventDefault()

                  const next =
                    ADJUSTMENT_KINDS[
                      (index + step + ADJUSTMENT_KINDS.length) % ADJUSTMENT_KINDS.length
                    ]
                  setKind(next.kind)
                  setReasonId(null)
                  // Focus follows selection in a radio group, so the next
                  // arrow press moves on from where the reader now is.
                  const group = event.currentTarget.parentElement
                  const buttons = group?.querySelectorAll<HTMLButtonElement>('button')
                  buttons?.[ADJUSTMENT_KINDS.indexOf(next)]?.focus()
                }}
                onClick={() => {
                  setKind(info.kind)
                  // The old code belongs to the old family, and a reason left
                  // behind from "Damaged" would post a write-off labelled as
                  // a return.
                  setReasonId(null)
                }}
              >
                <Icon size={20} aria-hidden />
                <span className="kind-card__label">{info.label}</span>
                <span className="kind-card__blurb">{info.blurb}</span>
              </button>
            )
          })}
        </div>

        <div className="field-row">
          <div className="field field--stacked">
            <label htmlFor="adj-sku">SKU (Select Uniform Item)</label>
            {/*
              A plain select, like the warehouse beside it and every other
              picker in the app.

              This was briefly an `<input list>` with a `<datalist>`, so the
              code could be typed. The browser draws that list itself and
              will not take our styling: Chrome sets the option's *value* —
              the bare code — in large text and the description under it in
              grey, which looks nothing like the rest of the system. A
              control we cannot style is not worth the typing.

              Native selects still jump to an option as you type its opening
              characters, so the code is reachable from the keyboard.
            */}
            <select
              id="adj-sku"
              className="input"
              value={skuId ?? ''}
              onChange={(event) =>
                setSkuId(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Choose a uniform item…</option>
              {skus.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.number} — {entry.garment_name} size {entry.size_name}
                </option>
              ))}
            </select>
          </div>

          <div className="field field--stacked">
            <label htmlFor="adj-warehouse">
              {kind === 'TRANSFER' ? 'Source Warehouse' : 'Active Warehouse Location'}
            </label>
            {canSwitch && warehouseId === null ? (
              <>
                <select
                  id="adj-warehouse"
                  className="input"
                  value={chosenWarehouse ?? ''}
                  onChange={(event) =>
                    setChosenWarehouse(event.target.value ? Number(event.target.value) : null)
                  }
                >
                  <option value="">Choose a warehouse…</option>
                  {options.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
                <p className="field__hint">
                  Stock lives at a site, so an adjustment has to name one. Switch
                  the warehouse in the top bar to lock it for every screen.
                </p>
              </>
            ) : (
              /*
                Locked rather than a second picker: the top bar already says
                which site you are looking at, and two controls that set the
                same thing is how somebody posts a write-off against the wrong
                warehouse.
              */
              <div className="input input--locked" id="adj-warehouse">
                <span>{siteLabel}</span>
                <Lock size={14} aria-hidden />
              </div>
            )}
          </div>
        </div>

        {kind === 'TRANSFER' && (
          <div className="field-row">
            <div className="field field--stacked">
              <label htmlFor="adj-destination">Destination Warehouse</label>
              <select
                id="adj-destination"
                className="input"
                value={destination ?? ''}
                aria-invalid={sameSite || undefined}
                onChange={(event) =>
                  setDestination(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Where it should end up…</option>
                {warehouses
                  // The server has a check constraint against moving stock to
                  // where it already is, so the option is not offered.
                  .filter((entry) => entry.id !== warehouse)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
              </select>
              <p className="field__hint">
                Moving several items in one go?{' '}
                <Link to="/transfers/new">Use the full transfer form</Link> — it
                takes as many SKUs as you need.
              </p>
            </div>
          </div>
        )}

        {kind === 'CORRECTION' ? (
          <div className="count-panel">
            <h3 className="count-panel__title">Inventory Correction Quantities</h3>

            <div className="count-panel__grid">
              <div className="field field--stacked">
                <label htmlFor="adj-system">System Logged Stock</label>
                <output id="adj-system" className="input input--readonly">
                  {systemStock === null
                    ? skuId && warehouse
                      ? 'Loading…'
                      : 'Pick an item first'
                    : `${formatQuantity(systemStock)} units`}
                </output>
                {/*
                  Spelled out whenever some of it is reserved. A counter is
                  looking at one shelf; the system holds two numbers for it,
                  and the difference between them is exactly what used to
                  make every count of a picked shelf post a phantom
                  correction upwards.
                */}
                {reserved !== null && reserved > 0 && (
                  <p className="field__hint">
                    {formatQuantity(available ?? 0)} available +{' '}
                    {formatQuantity(reserved)} picked for an order that has not
                    shipped. Both are on the shelf — count them.
                  </p>
                )}
              </div>

              <div className="field field--stacked">
                <label htmlFor="adj-counted">Physical Count Verified</label>
                <input
                  id="adj-counted"
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  placeholder="What was on the shelf"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>

              <div className="field field--stacked">
                <label htmlFor="adj-difference">Net Difference</label>
                <output
                  id="adj-difference"
                  className={`input input--readonly${
                    effect === null ? '' : effect < 0 ? ' input--down' : ' input--up'
                  }`}
                >
                  {effect === null ? '—' : `${formatSigned(effect)} units`}
                </output>
              </div>

              <div className="field field--stacked">
                <label htmlFor="adj-required">Required Adjustment</label>
                <output
                  id="adj-required"
                  className={`input input--readonly${
                    effect === null ? '' : effect < 0 ? ' input--down' : ' input--up'
                  }`}
                >
                  {effect === null ? '—' : formatSigned(effect)}
                </output>
              </div>
            </div>

            <p className="field__hint count-panel__foot">
              <span>
                The system works out the difference and picks the reason code —
                count up or count down — so nobody counting has to do the
                subtraction or choose a direction.
              </span>
              {/*
                On the panel's own hint line rather than as a field of its
                own, so the form keeps the four boxes the design draws.

                It still has to be here. A count sheet comes off the floor on
                Friday and gets keyed on Monday, and the server compares
                against what it held *on this date* — posting it as today
                reconciles against the wrong figure and values it at the
                wrong price.
              */}
              <label className="count-panel__date">
                <span>Counted on</span>
                <input
                  type="date"
                  value={occurredOn}
                  max={todayISO()}
                  aria-label="Date the count was taken"
                  onChange={(event) => setOccurredOn(event.target.value || todayISO())}
                />
              </label>
            </p>
          </div>
        ) : (
          <div className="count-panel">
            <h3 className="count-panel__title">Quantities</h3>

            <div className="count-panel__grid">
              <div className="field field--stacked">
                <label htmlFor="adj-system">Available Stock</label>
                <output id="adj-system" className="input input--readonly">
                  {available === null
                    ? skuId && warehouse
                      ? 'Loading…'
                      : 'Pick an item first'
                    : `${formatQuantity(available)} units`}
                </output>
                {reserved !== null && reserved > 0 && (
                  <p className="field__hint">
                    A further {formatQuantity(reserved)} are picked for an order
                    that has not shipped. Those cannot be moved or written off
                    from here.
                  </p>
                )}
              </div>

              <div className="field field--stacked">
                <label htmlFor="adj-quantity">
                  {kind === 'TRANSFER' ? 'Units to Move' : 'Units Affected'}
                </label>
                <input
                  id="adj-quantity"
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="How many"
                  aria-invalid={overdrawn || undefined}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <p className="field__hint">
                  {kind === 'TRANSFER'
                    ? 'Leaves the source and arrives at the destination at the same value.'
                    : 'A count, never a sign. The reason code decides whether this adds or removes.'}
                </p>
              </div>

              <div className="field field--stacked">
                <label htmlFor="adj-effect">
                  {kind === 'TRANSFER' ? 'Leaves This Site' : 'Effect on Stock'}
                </label>
                <output
                  id="adj-effect"
                  className={`input input--readonly${
                    effect === null ? '' : effect < 0 ? ' input--down' : ' input--up'
                  }`}
                >
                  {effect === null ? '—' : `${formatSigned(effect)} units`}
                </output>
              </div>

              <div className="field field--stacked">
                <label htmlFor="adj-result">
                  {kind === 'TRANSFER' ? 'Left at Source' : 'Stock Afterwards'}
                </label>
                <output id="adj-result" className="input input--readonly">
                  {availableAfter === null ? '—' : `${formatQuantity(availableAfter)} units`}
                </output>
              </div>
            </div>

            <p className="field__hint count-panel__foot">
              <span>
                {kind === 'TRANSFER'
                  ? 'Stock leaves the source and arrives at the destination at the same value.'
                  : 'The reason code decides the direction. Nobody types a sign.'}
              </span>
              <label className="count-panel__date">
                <span>{kind === 'TRANSFER' ? 'Moves on' : 'Happened on'}</span>
                <input
                  type="date"
                  value={occurredOn}
                  max={todayISO()}
                  aria-label="Date of the change"
                  onChange={(event) => setOccurredOn(event.target.value || todayISO())}
                />
              </label>
            </p>
          </div>
        )}

        <div className="field-row">
          <div className="field field--stacked">
            <label htmlFor="adj-reason">Primary Adjustment Reason</label>
            {kind === 'CORRECTION' ? (
              <div className="input input--locked">
                <span>Chosen by the system from the difference</span>
                <Lock size={14} aria-hidden />
              </div>
            ) : kind === 'TRANSFER' ? (
              /*
                Optional here, unlike the coded kinds. A transfer is a
                movement in its own right — the code is a note about why the
                rebalancing was needed, and does not decide what happens.
              */
              <select
                id="adj-reason"
                className="input"
                value={reasonId ?? ''}
                onChange={(event) =>
                  setReasonId(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Optional</option>
                {codes
                  .filter((code) => code.is_active !== false)
                  .map((code) => (
                    <option key={code.id} value={code.id}>
                      {code.name}
                    </option>
                  ))}
              </select>
            ) : (
              <select
                id="adj-reason"
                className="input"
                value={reasonId ?? ''}
                onChange={(event) =>
                  setReasonId(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Choose a reason…</option>
                {reasonOptions.map((code) => (
                  <option key={code.id} value={code.id}>
                    {code.name}
                  </option>
                ))}
              </select>
            )}

            {kind !== 'CORRECTION' && kind !== 'TRANSFER' && reasonOptions.length === 0 && (
              /*
                The codes are master data the leads maintain, not a list this
                screen owns. If the one this card needs has been retired there
                is nothing to pick, and saying so beats an empty dropdown.
              */
              <p className="field-error">
                No active reason code for this type. Ask a Program Lead to add
                one under master data before posting.
              </p>
            )}
          </div>

          <div className="field field--stacked field--grow">
            <label htmlFor="adj-notes">Notes &amp; Observations</label>
            <textarea
              id="adj-notes"
              className="input input--area"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                needsNote
                  ? 'What happened, where, and who found it.'
                  : 'Where it was found, who counted it, which shelf.'
              }
              aria-invalid={noteMissing && notes.trim() !== '' ? true : undefined}
              aria-required={needsNote || undefined}
            />
            {noteMissing && notes.trim() !== '' && (
              <p className="field-error">
                A sentence, not a word. Whoever reads this row next has only
                what is written here.
              </p>
            )}
            <p className="field__hint">
              {needsNote
                ? 'Required for a loss or a write-off. The reason code says which category; this says what actually happened, and it is all an auditor will have.'
                : 'The only place the reason behind the reason code is recorded. An auditor reading this row a year from now has nothing else.'}
            </p>
          </div>
        </div>

        {overdrawn && (
          <Alert tone="error">
            <strong>More than is available.</strong> {sourceName} has{' '}
            {formatQuantity(available ?? 0)} units of {sku?.number} free to move
            {reserved !== null && reserved > 0
              ? `, with a further ${reserved} already picked for an order`
              : ''}
            . This entry would take the available figure below zero, and the
            server refuses it — stock reserved for a pick cannot be taken back
            from here.
          </Alert>
        )}

        {/*
          The sentence the design draws in orange, built from what is actually
          on the form. Deliberately names the SKU, the number and the site:
          "are you sure?" asks nothing a reader can check.
        */}
        {!overdrawn && ready && effect !== null && (
          <Alert tone="warning">
            {kind === 'TRANSFER' ? (
              <>
                <strong>System warning:</strong> posting this moves{' '}
                {Math.abs(effect)} units of {sku?.number} out of {sourceName} and
                into {destinationName}, immediately and permanently.{' '}
                {sourceName} is left with {formatQuantity(availableAfter ?? 0)}{' '}
                available. No money moves — the stock is worth the same at
                either site.
                {occurredOn !== todayISO() && ` Dated ${formatDay(occurredOn)}.`}
              </>
            ) : (
              <>
                <strong>System warning:</strong> posting this will{' '}
                {effect < 0 ? 'reduce' : 'increase'} available inventory for{' '}
                {sku?.number} by {Math.abs(effect)} units at {sourceName},
                immediately and permanently. Available becomes{' '}
                {formatQuantity(availableAfter ?? 0)}
                {estimate ? `, and the change is worth ${estimate}` : ''}.
                {occurredOn !== todayISO() && ` Dated ${formatDay(occurredOn)}.`}
              </>
            )}
          </Alert>
        )}

        {kind === 'CORRECTION' && hasQuantity && effect === 0 && (
          <Alert tone="info">
            The count matches what the system holds, so there is nothing to
            correct and nothing will be posted.
          </Alert>
        )}

        {/*
          Kept on screen rather than in a snackbar that fades: this is the
          moment somebody needs to read what went wrong, and a failure after
          the create half succeeded leaves a numbered draft they have to know
          about.
        */}
        {failure instanceof DraftLeftBehind ? (
          <Alert tone="error">
            <strong>{failure.draftNumber} was written down but not posted.</strong>{' '}
            No stock has moved. {toApiError(failure.cause).message} The draft is in
            the list and can be posted once the cause is fixed.
          </Alert>
        ) : failure ? (
          <Alert tone="error">
            <strong>Nothing was posted.</strong> {toApiError(failure).message}
          </Alert>
        ) : null}

      </section>

      <div className="compose__bar">
        <div className="compose__summary">
          <p className="compose__count">
            {warehouse === null
              ? 'Choose a warehouse to adjust.'
              : skuId === null
                ? 'Choose the uniform item.'
                : !hasQuantity
                  ? kind === 'CORRECTION'
                    ? 'Enter the physical count.'
                    : 'Enter how many units.'
                  : ready
                    ? 'Ready to post.'
                    : kind !== 'CORRECTION' && reasonId === null
                      ? 'Choose a reason.'
                      : 'Nothing to post.'}
          </p>
        </div>

        <div className="compose__actions">
          <Button
            variant="secondary"
            onClick={() => navigate('/adjustments')}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button disabled={!ready} onClick={submit}>
            {pending ? 'Posting…' : kind === 'TRANSFER' ? 'Post Transfer' : 'Post Adjustment'}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
