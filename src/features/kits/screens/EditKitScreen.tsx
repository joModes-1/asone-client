/**
 * Edit a uniform kit — its details and its bill of materials.
 *
 * A separate screen from Create, not a flag on it. The two look alike and do
 * different things: creating writes a kit and then its lines; editing works
 * out what *changed* and sends only that. Folding them together means every
 * branch of the form asking "which am I?", and the one that matters here —
 * a line that was removed has to be deleted on the server, not simply left
 * out — has no equivalent on the create path at all.
 *
 * ---------------------------------------------------------------------------
 * Changing the school level is refused, not handled
 * ---------------------------------------------------------------------------
 * A kit's level decides which garments may be in it. Changing it on a kit
 * that already has components would either silently drop the ones that no
 * longer fit or leave the kit in a state the server rejects. Neither is a
 * thing to do quietly, so the field is locked and says why: build the other
 * kit and deactivate this one, which is what the history should show anyway.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Lock, Plus, Trash2 } from 'lucide-react'
import { Alert, Button, LoadingScreen } from '@/components'
import { toApiError } from '@/api/errors'
import * as kitsApi from '@/api/kits'
import { formatUGX, multiplyMoney, sumLineTotals } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { useSkuOptions } from '@/features/catalog/hooks/useSkuOptions'
import { useKit, useKitComponents, useUpdateKit } from '../hooks/useKits'
import type { Sku } from '@/api/types'

interface Line {
  key: number
  /** The KitItem's id, or null for a line added in this session. */
  itemId: number | null
  sku: number | null
  quantity: number
}

export function EditKitScreen() {
  const { kitId } = useParams()
  const id = Number(kitId)
  const navigate = useNavigate()

  const kit = useKit(id)
  const components = useKitComponents()
  const skusQuery = useSkuOptions()
  const updateKit = useUpdateKit(id)

  const [name, setName] = useState('')
  const [kitNumber, setKitNumber] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [lines, setLines] = useState<Line[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  /*
    Keys for lines added in this session. Negative, so they cannot collide
    with a KitItem id — which is what keys an existing line, and is stable
    across a refetch in a way an index never is.
  */
  const [nextKey, setNextKey] = useState(-1)

  const loaded = kit.data && !components.isLoading

  /*
    Seeded once, from the server's copy, during render rather than in an
    effect — the values come from a query that has just resolved, so an
    effect would paint an empty form and correct it a frame later.

    `lines === null` is what says "not seeded yet". An empty array is a real
    state — a kit somebody emptied — and seeding on it would put the removed
    lines straight back.
  */
  if (loaded && lines === null) {
    setName(kit.data.name)
    setKitNumber(kit.data.kit_number)
    setDescription(kit.data.description ?? '')
    setIsActive(kit.data.is_active ?? true)
    setLines(
      (components.byKit.get(id) ?? []).map((item) => ({
        key: item.id,
        itemId: item.id,
        sku: item.sku,
        quantity: item.quantity,
      })),
    )
  }

  const skus = useMemo(() => skusQuery.data?.results ?? [], [skusQuery.data])
  const level = kit.data?.school_level

  const eligible = useMemo(
    () =>
      skus.filter(
        (sku) => sku.garment_school_level === level || sku.garment_school_level === 'BOTH',
      ),
    [skus, level],
  )

  const rows = lines ?? []
  const chosen = new Set(rows.map((line) => line.sku).filter((v): v is number => v !== null))
  const incomplete = rows.filter((line) => line.sku === null)

  function skuOf(skuId: number | null): Sku | undefined {
    return skus.find((entry) => entry.id === skuId)
  }

  const totalUnits = rows.reduce((sum, line) => sum + (line.sku ? line.quantity : 0), 0)
  const unpriced = rows.filter((line) => {
    const sku = skuOf(line.sku)
    return sku && !sku.unit_price
  })

  const estimate = sumLineTotals(
    rows.flatMap((line) => {
      const sku = skuOf(line.sku)
      if (!sku?.unit_price) return []
      return [{ unit: sku.unit_price, quantity: line.quantity }]
    }),
  )

  const ready =
    name.trim() !== '' &&
    kitNumber.trim() !== '' &&
    rows.length > 0 &&
    incomplete.length === 0 &&
    !saving

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prior) =>
      (prior ?? []).map((line) => (line.key === key ? { ...line, ...patch } : line)),
    )
  }

  async function save() {
    if (!ready || !kit.data) return
    setSaving(true)
    setFailure(null)

    const original = components.byKit.get(id) ?? []
    const problems: string[] = []

    try {
      await updateKit.mutateAsync({
        name: name.trim(),
        kit_number: kitNumber.trim(),
        description: description.trim(),
        is_active: isActive,
      })
    } catch (error) {
      setFailure(`The kit details were not saved: ${toApiError(error).message}`)
      setSaving(false)
      return
    }

    // Removed first, so a SKU moved from one line to another does not collide
    // with the unique-per-kit constraint on its way through.
    for (const item of original) {
      if (rows.some((line) => line.itemId === item.id)) continue
      try {
        await kitsApi.removeKitItem(item.id)
      } catch (error) {
        problems.push(`could not remove ${item.sku_number} (${toApiError(error).message})`)
      }
    }

    for (const line of rows) {
      const before = original.find((item) => item.id === line.itemId)
      try {
        if (!before) {
          await kitsApi.addKitItem({
            kit: id,
            sku: line.sku as number,
            quantity: line.quantity,
          })
        } else if (before.quantity !== line.quantity) {
          await kitsApi.updateKitItem(line.itemId as number, line.quantity)
        }
      } catch (error) {
        const sku = skuOf(line.sku)
        problems.push(`${sku?.number ?? 'a line'} (${toApiError(error).message})`)
      }
    }

    if (problems.length > 0) {
      // The details saved and some lines did not. Named here rather than
      // navigating away, which would hide a half-applied change.
      setFailure(
        `The kit details were saved, but ${problems.length} component ${problems.length === 1 ? 'change was' : 'changes were'} refused: ${problems.join('; ')}.`,
      )
      setSaving(false)
      return
    }

    navigate(`/kits/${id}`)
  }

  if (kit.isLoading || skusQuery.isLoading || lines === null) {
    return <LoadingScreen message="Loading the kit" />
  }

  if (kit.isError || !kit.data) {
    return (
      <AppShell title="Uniform Kits">
        <Alert tone="error">This kit could not be loaded.</Alert>
      </AppShell>
    )
  }

  return (
    <AppShell title="Uniform Kits">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/kits">Uniform Kits</Link>
        <ChevronRight size={14} aria-hidden />
        <Link to={`/kits/${id}`}>{kit.data.name}</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">Edit</span>
      </nav>

      <header className="page-head">
        <h1 className="page-head__title">Edit Kit</h1>
        <p className="page-head__subtitle">
          Changes take effect on the next order. Orders already placed were
          turned into their component items and are unaffected.
        </p>
      </header>

      <div className="compose compose--even">
        <section className="card-panel compose__details">
          <h2 className="card-panel__title card-panel__title--accent">Kit Details</h2>

          <div className="field field--stacked">
            <label htmlFor="kit-name">Kit Name</label>
            <input
              id="kit-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="field field--stacked">
            <label htmlFor="kit-number">Kit Number</label>
            <input
              id="kit-number"
              className="input"
              value={kitNumber}
              onChange={(event) => setKitNumber(event.target.value)}
            />
          </div>

          <div className="field field--stacked">
            <label htmlFor="kit-level">Kit Type</label>
            <div className="input input--locked" id="kit-level">
              <span>{kit.data.school_level_display}</span>
              <Lock size={14} aria-hidden />
            </div>
            <p className="field__hint">
              A kit's level decides which garments may be in it, so it cannot be
              changed once the kit exists. Build the other kit and deactivate
              this one — which is what the history should show anyway.
            </p>
          </div>

          <div className="field field--stacked">
            <label htmlFor="kit-description">Description</label>
            <textarea
              id="kit-description"
              className="input input--area"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="field field--stacked">
            <label className="kit-toggle" htmlFor="kit-active">
              <input
                id="kit-active"
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span>Active</span>
            </label>
            <p className="field__hint">
              Only active kits can be added to a new order.
            </p>
          </div>
        </section>

        <section className="card-panel compose__lines">
          <div className="card-panel__head">
            <h2 className="card-panel__title card-panel__title--accent">Kit Components</h2>
            <Button
              size="sm"
              onClick={() => {
                setLines((prior) => [
                  ...(prior ?? []),
                  { key: nextKey, itemId: null, sku: null, quantity: 1 },
                ])
                setNextKey((key) => key - 1)
              }}
            >
              <Plus size={14} aria-hidden />
              Add Component
            </Button>
          </div>

          <div className="table-scroll">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="ledger__num">Qty per kit</th>
                  <th className="ledger__num">Line total</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {rows.map((line, index) => {
                  const sku = skuOf(line.sku)

                  return (
                    <tr key={line.key}>
                      <td>
                        <select
                          className="input"
                          aria-label={`Item for line ${index + 1}`}
                          aria-invalid={line.sku === null || undefined}
                          value={line.sku ?? ''}
                          onChange={(event) =>
                            updateLine(line.key, {
                              sku: event.target.value ? Number(event.target.value) : null,
                            })
                          }
                        >
                          <option value="">Choose an item…</option>
                          {eligible
                            .filter((entry) => entry.id === line.sku || !chosen.has(entry.id))
                            .map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.number} — {entry.garment_name} size {entry.size_name}
                              </option>
                            ))}
                        </select>
                        {sku && (
                          <p className="line-note">
                            {sku.unit_price
                              ? `${formatUGX(sku.unit_price)} each`
                              : 'No price on file'}
                          </p>
                        )}
                      </td>

                      <td className="ledger__num">
                        <input
                          className="input input--count"
                          type="number"
                          min={1}
                          step={1}
                          aria-label={`Quantity for line ${index + 1}`}
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.key, {
                              quantity: Math.max(
                                1,
                                Math.round(Number(event.target.value) || 1),
                              ),
                            })
                          }
                        />
                      </td>

                      <td className="ledger__num t-numeric">
                        {sku?.unit_price
                          ? formatUGX(multiplyMoney(sku.unit_price, line.quantity))
                          : '—'}
                      </td>

                      <td className="ledger__num">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove line ${index + 1}`}
                          disabled={rows.length === 1}
                          onClick={() =>
                            setLines((prior) =>
                              (prior ?? []).filter((entry) => entry.key !== line.key),
                            )
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
              {incomplete.length === 1
                ? 'One line has no item chosen. Pick one, or remove the row.'
                : `${incomplete.length} lines have no item chosen. Pick them, or remove the rows.`}
            </p>
          )}

          {unpriced.length > 0 && (
            <p className="callout callout--warning">
              {unpriced.length === 1 ? 'One item has' : `${unpriced.length} items have`} no
              price today, so this kit will have no total until they are priced.
            </p>
          )}

          <p className="field__hint">
            Removing a line says the kit no longer contains it. Past orders are
            unaffected — they became their component items when they were placed
            and never refer back.
          </p>
        </section>
      </div>

      {failure && <Alert tone="error">{failure}</Alert>}

      <div className="compose__bar">
        <div className="compose__summary">
          <p className="compose__count">
            {incomplete.length > 0
              ? 'Choose an item for every line.'
              : `${totalUnits} items across ${rows.length} line${rows.length === 1 ? '' : 's'}`}
          </p>
          {totalUnits > 0 && unpriced.length === 0 && (
            <p className="compose__total">
              <span>Kit price</span>
              <strong className="t-numeric">{formatUGX(estimate)}</strong>
            </p>
          )}
        </div>

        <div className="compose__actions">
          <Button
            variant="secondary"
            onClick={() => navigate(`/kits/${id}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button disabled={!ready} onClick={save}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
