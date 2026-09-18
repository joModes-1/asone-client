/**
 * New Warehouse Transfer — F25.
 *
 * Stock moving between two of AsOne's own sites. **No money moves**: posting
 * writes two ledger rows per line at the same unit value, one out and one in,
 * so total inventory value is identical before and after.
 *
 * Not a backorder transfer, which is a different thing entirely — there a
 * warehouse takes over responsibility for somebody else's order and ships
 * direct to the school, and no goods pass between warehouses at all. This
 * moves the goods.
 *
 * A page rather than a dialog, for the same reason the production order form
 * is: an unbounded line table with a quantity a row, where a stray click
 * would lose the lot.
 *
 * Three things the form has to get right, because the server refuses
 * otherwise and a 400 after the whole transfer is keyed is the worst outcome:
 *
 *   **Source and destination must differ.** The server has a check
 *   constraint for it — a transfer to where the stock already is would post a
 *   matching pair that cancels out, noise in the audit trail implying
 *   something happened when nothing did.
 *   **A SKU may appear once.** Chosen SKUs drop out of the picker.
 *   **The source has to hold what is being moved.** Checked here against
 *   what the source currently shows, and again by the server at posting,
 *   because stock moves in between.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Alert, Button, LoadingScreen } from '@/components'
import { toApiError } from '@/api/errors'
import { todayISO } from '@/domain/dates'
import { formatQuantity } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { useSkuOptions } from '@/features/catalog/hooks/useSkuOptions'
import { useWarehouseOptions } from '@/features/catalog/hooks/useWarehouseOptions'
import {
  DraftLeftBehind,
  usePostTransfer,
  useReasonCodes,
  useStockOnHand,
} from '../hooks/useAdjustments'

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

export function NewTransferScreen() {
  const navigate = useNavigate()

  const { warehouses, isLoading: warehousesLoading } = useWarehouseOptions()
  const skusQuery = useSkuOptions()
  const reasonCodes = useReasonCodes()
  const postTransfer = usePostTransfer()

  const [source, setSource] = useState<number | null>(null)
  const [destination, setDestination] = useState<number | null>(null)
  const [reasonId, setReasonId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>(() => [blankLine()])

  const sourceStock = useStockOnHand(source)

  const skus = useMemo(() => skusQuery.data?.results ?? [], [skusQuery.data])
  const codes = useMemo(
    () => (reasonCodes.data?.results ?? []).filter((code) => code.is_active !== false),
    [reasonCodes.data],
  )

  const chosen = useMemo(
    () => new Set(lines.map((line) => line.sku).filter((id): id is number => id !== null)),
    [lines],
  )

  /** Units of one SKU the source currently shows. Null while unknown. */
  function availableAt(skuId: number | null): number | null {
    if (!skuId || source === null || !sourceStock.data) return null
    const row = sourceStock.data.find(
      (entry) => entry.sku_id === skuId && entry.warehouse_id === source,
    )
    return row?.level ?? 0
  }

  const sameSite = source !== null && source === destination
  const incomplete = lines.filter((line) => line.sku === null)

  const short = lines.filter((line) => {
    const have = availableAt(line.sku)
    return have !== null && line.quantity > have
  })

  const totalUnits = lines.reduce((sum, line) => sum + (line.sku ? line.quantity : 0), 0)

  const ready =
    source !== null &&
    destination !== null &&
    !sameSite &&
    lines.length > 0 &&
    incomplete.length === 0 &&
    short.length === 0 &&
    !postTransfer.isPending

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((prior) => prior.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function submit() {
    if (!ready || source === null || destination === null) return

    postTransfer.mutate(
      {
        from_warehouse: source,
        to_warehouse: destination,
        transfer_date: todayISO(),
        ...(reasonId ? { reason_code: reasonId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: lines.map((line) => ({ sku: line.sku as number, quantity: line.quantity })),
      },
      { onSuccess: () => navigate('/transfers') },
    )
  }

  if (skusQuery.isLoading || warehousesLoading) {
    return <LoadingScreen message="Loading the catalogue" />
  }

  const failure = postTransfer.error

  return (
    <AppShell title="Warehouse Transfers">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/transfers">Warehouse Transfers</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">New Transfer Request</span>
      </nav>

      <header className="page-head">
        <h1 className="page-head__title">Create Warehouse Transfer</h1>
        <p className="page-head__subtitle">
          Moves stock between two AsOne warehouses. Nothing is bought or sold, so
          the total value of inventory is unchanged.
        </p>
      </header>

      <section className="card-panel">
        <div className="field-row">
          <div className="field field--stacked">
            <label htmlFor="xfer-source">Source Warehouse</label>
            <select
              id="xfer-source"
              className="input"
              value={source ?? ''}
              onChange={(event) =>
                setSource(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Where the stock is now…</option>
              {warehouses.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field field--stacked">
            <label htmlFor="xfer-destination">Destination Warehouse</label>
            <select
              id="xfer-destination"
              className="input"
              value={destination ?? ''}
              aria-invalid={sameSite || undefined}
              onChange={(event) =>
                setDestination(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Where it should end up…</option>
              {warehouses
                // Filtered rather than caught on submit: the server has a
                // check constraint for this, and a dropdown that offers an
                // impossible answer is the screen's mistake, not the user's.
                .filter((entry) => entry.id !== source)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="card-panel__head">
          <h2 className="card-panel__title card-panel__title--accent">Items to Transfer</h2>
          <Button size="sm" onClick={() => setLines((prior) => [...prior, blankLine()])}>
            <Plus size={14} aria-hidden />
            Add Product SKU
          </Button>
        </div>

        <div className="table-scroll">
          <table className="ledger">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Description</th>
                <th className="ledger__num">Avail at Source</th>
                <th className="ledger__num">Transfer Qty</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const sku = skus.find((entry) => entry.id === line.sku)
                const have = availableAt(line.sku)
                const label = sku ? sku.number : `line ${index + 1}`
                const overdrawn = have !== null && line.quantity > have

                return (
                  <tr key={line.key}>
                    <td>
                      <select
                        className="input"
                        aria-label={`SKU for line ${index + 1}`}
                        aria-invalid={line.sku === null || undefined}
                        value={line.sku ?? ''}
                        onChange={(event) =>
                          updateLine(line.key, {
                            sku: event.target.value ? Number(event.target.value) : null,
                          })
                        }
                      >
                        <option value="">Choose a SKU…</option>
                        {skus
                          // A SKU may appear once per transfer — the server
                          // has a unique constraint on it.
                          .filter((entry) => entry.id === line.sku || !chosen.has(entry.id))
                          .map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.number}
                            </option>
                          ))}
                      </select>
                    </td>

                    <td className="ledger__wrap">
                      {sku ? `${sku.garment_name} size ${sku.size_name}` : '—'}
                    </td>

                    <td className="ledger__num t-numeric">
                      {/*
                        The figure that decides whether this line is possible,
                        so it is on the row rather than discovered as a 400.
                      */}
                      {source === null
                        ? 'Pick a source'
                        : have === null
                          ? '—'
                          : `${formatQuantity(have)} units`}
                    </td>

                    <td className="ledger__num">
                      <input
                        className="input input--count"
                        type="number"
                        min={1}
                        step={1}
                        aria-label={`Transfer quantity for ${label}`}
                        aria-invalid={overdrawn || undefined}
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

        {incomplete.length > 0 && (
          <p className="callout callout--warning">
            <AlertTriangle size={16} aria-hidden />
            {incomplete.length === 1
              ? 'One line has no SKU chosen. Pick one, or remove the row.'
              : `${incomplete.length} lines have no SKU chosen. Pick them, or remove the rows.`}
          </p>
        )}

        {short.length > 0 && (
          <p className="callout callout--warning">
            <AlertTriangle size={16} aria-hidden />
            {short.length === 1 ? 'One line asks' : `${short.length} lines ask`} for more than
            the source warehouse holds. The transfer would be refused, and stock that is not on
            the shelf cannot be moved.
          </p>
        )}

        <div className="field-row">
          <div className="field field--stacked">
            <label htmlFor="xfer-reason">Reason for Transfer</label>
            <select
              id="xfer-reason"
              className="input"
              value={reasonId ?? ''}
              onChange={(event) =>
                setReasonId(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Optional</option>
              {codes.map((code) => (
                <option key={code.id} value={code.id}>
                  {code.name}
                </option>
              ))}
            </select>
            <p className="field__hint">Optional. Why the rebalancing was needed.</p>
          </div>

          <div className="field field--stacked field--grow">
            <label htmlFor="xfer-notes">Additional Notes / Dispatch Instructions</label>
            <textarea
              id="xfer-notes"
              className="input input--area"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything the receiving warehouse should know."
            />
          </div>
        </div>

        {failure instanceof DraftLeftBehind ? (
          <Alert tone="error">
            <strong>{failure.draftNumber} was written down but not posted.</strong> No stock has
            moved at either warehouse. {toApiError(failure.cause).message}
          </Alert>
        ) : failure ? (
          <Alert tone="error">
            <strong>Nothing was transferred.</strong> {toApiError(failure).message}
          </Alert>
        ) : null}

      </section>

      <div className="compose__bar">
        <div className="compose__summary">
          {/* Names the step that is actually missing. "Add at least one SKU"
              while a row sits on screen waiting for one reads as a bug in the
              form rather than an instruction. */}
          <p className="compose__count">
            {source === null
              ? 'Choose the source warehouse.'
              : destination === null
                ? 'Choose the destination warehouse.'
                : incomplete.length > 0
                  ? 'Choose a SKU for every line.'
                  : `${totalUnits} units across ${lines.length} line${lines.length === 1 ? '' : 's'}`}
          </p>
          {ready && (
            <p className="compose__total">
              <span>Effect on total stock value</span>
              <strong className="t-numeric">None</strong>
            </p>
          )}
        </div>

        <div className="compose__actions">
          <Button
            variant="secondary"
            onClick={() => navigate('/transfers')}
            disabled={postTransfer.isPending}
          >
            Cancel
          </Button>
          <Button disabled={!ready} onClick={submit}>
            {postTransfer.isPending ? 'Posting…' : 'Submit Transfer'}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
