/**
 * Create a uniform kit — F07.
 *
 * A page rather than a dialog, for the same reason the production order form
 * is one: it carries an unbounded component table, and a stray click in a
 * modal loses the lot.
 *
 * ---------------------------------------------------------------------------
 * Two things the design asks for that are not built, and why
 * ---------------------------------------------------------------------------
 *
 * **"Calculated Sourcing Cost (UGX)" as a required input.** It is shown here,
 * but read-only and computed. The design's own detail screen says the total
 * is the sum of component prices with no bundle discount, and a typed figure
 * beside a computed one is two sources of truth for money — the moment a
 * garment is repriced they disagree and nothing says which is right. Worth
 * putting to AsOne: if they want a kit price that is *not* the sum of its
 * parts, that is a real feature, not a field.
 *
 * **"Sourcing Notes."** Dropped. AsOne buys through production orders at
 * prices agreed with a Tailoring Center, and that negotiation is recorded on
 * the production order where it happens. A second place to write it down is
 * a second place to look.
 *
 * ---------------------------------------------------------------------------
 * Creating in two calls, reported as one
 * ---------------------------------------------------------------------------
 * A component needs a kit to belong to, so the kit is created first and its
 * lines posted after. Those can half-succeed, and a kit created with three of
 * five components is worse than either outcome if nobody is told — so the
 * failure names the kit and what did not make it.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Lock, Plus, Trash2 } from 'lucide-react'
import { Alert, Button, LoadingScreen } from '@/components'
import { toApiError } from '@/api/errors'
import {
  KIT_FIT_GROUPS,
  KIT_GENDERS,
  KIT_RESIDENCES,
  composeKitNumber,
  fitsKit,
  priceListFor,
} from '@/domain/kitCohort'
import { formatUGX, multiplyMoney, sumLineTotals } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { useSkuOptions } from '@/features/catalog/hooks/useSkuOptions'
import { useSizeOptions } from '@/features/inventory/hooks/useSizeOptions'
import { componentFailure } from '../componentFailure'
import type { Sku } from '@/api/types'
import { useCreateKit } from '../hooks/useKits'

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

const LEVELS = [
  { value: 'PS', label: 'Primary School' },
  { value: 'HS', label: 'High School' },
]

export function CreateKitScreen() {
  const navigate = useNavigate()
  const skusQuery = useSkuOptions()
  const { sizes } = useSizeOptions()
  const createKit = useCreateKit()

  const [kitNumber, setKitNumber] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [generalLevel, setGeneralLevel] = useState('PS')
  const [isActive, setIsActive] = useState(true)
  /*
    The cohort this kit is cut for. Empty means "not stated", which is a real
    kit — the demo starter kits name no gender — so these are four optional
    fields that stand or fall together, exactly as `Kit.clean()` has it.
  */
  const [fitGroup, setFitGroup] = useState('')
  const [gender, setGender] = useState('')
  const [residence, setResidence] = useState('')
  const [sizeId, setSizeId] = useState<number | null>(null)
  const [lines, setLines] = useState<DraftLine[]>(() => [blankLine()])
  /*
    A refused component, named by its row. Called `refused` and not
    `partial` any more: there is no partial outcome to report now that the
    kit and its lines are one request.
  */
  const [refused, setRefused] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const skus = useMemo(() => skusQuery.data?.results ?? [], [skusQuery.data])

  /*
    A class band decides the price list — Nursery, P1–P4 and P5–P7 are
    Primary; S1–S4 and S5–S6 are High School. The server derives it on save
    (`Kit.PRICE_LIST_BY_FIT_GROUP`), so the form shows it rather than asking,
    and only a kit stating no band is asked which level it is for.
  */
  const level = priceListFor(fitGroup) ?? generalLevel
  const statesCohort = fitGroup !== ''
  const sizeName = sizes.find((size) => size.id === sizeId)?.name ?? null
  /* What the server will assign. Null until all four parts are stated. */
  const composedNumber = composeKitNumber({ fitGroup, gender, residence, sizeName })
  const cohortIncomplete =
    statesCohort && (gender === '' || residence === '' || sizeId === null)

  /*
    What may go into this kit, by the same three rules the server applies —
    price list, class band and size. Filtered here so the picker cannot
    offer something that would be refused after the fact; see `fitsKit`.

    It narrows as the cohort is filled in, which is the point: pick Nursery
    and the Upper Primary sweaters go away.
  */
  const eligible = useMemo(
    () => skus.filter((sku) => fitsKit(sku, { level, fitGroup, sizeId })),
    [skus, level, fitGroup, sizeId],
  )

  const chosen = useMemo(
    () => new Set(lines.map((line) => line.sku).filter((id): id is number => id !== null)),
    [lines],
  )

  function skuOf(id: number | null): Sku | undefined {
    return skus.find((entry) => entry.id === id)
  }

  const incomplete = lines.filter((line) => line.sku === null)
  const unpriced = lines.filter((line) => {
    const sku = skuOf(line.sku)
    return sku && !sku.unit_price
  })

  const totalUnits = lines.reduce((sum, line) => sum + (line.sku ? line.quantity : 0), 0)

  /** The sum the kit will carry. Computed, never typed. */
  const estimate = sumLineTotals(
    lines.flatMap((line) => {
      const sku = skuOf(line.sku)
      if (!sku?.unit_price) return []
      return [{ unit: sku.unit_price, quantity: line.quantity }]
    }),
  )

  /*
    A kit needs a number. A kit stating a cohort gets one composed, so what
    it needs instead is all four parts — half a cohort composes nothing and
    the server refuses it.
  */
  const numbered = statesCohort ? composedNumber !== null : kitNumber.trim() !== ''

  const ready =
    numbered &&
    name.trim() !== '' &&
    lines.length > 0 &&
    incomplete.length === 0 &&
    !saving

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((prior) => prior.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  async function submit() {
    if (!ready) return
    setSaving(true)
    setRefused(null)

    try {
      const kit = await createKit.mutateAsync({
        items: lines.map((line) => ({
          sku: line.sku as number,
          quantity: line.quantity,
        })),
        name: name.trim(),
        is_active: isActive,
        ...(description.trim() ? { description: description.trim() } : {}),
        /*
          One or the other, never both. A kit stating a cohort has its number
          and its school level derived from it on the server; sending our own
          copy of either is a second source of truth for the same fact.
        */
        ...(statesCohort
          ? { fit_group: fitGroup, gender, residence, size: sizeId }
          : { kit_number: kitNumber.trim(), school_level: level }),
      })

      navigate(`/kits/${kit.id}`)
    } catch (error) {
      // A component the server refuses comes back keyed by its position in
      // the table, so the row can be named rather than the whole form
      // flagged. Nothing was written — the kit and its lines are one
      // transaction — which is the sentence that matters here.
      setRefused(componentFailure(error, lines, skuOf))
      setSaving(false)
    }
  }

  if (skusQuery.isLoading) return <LoadingScreen message="Loading the catalogue" />

  return (
    <AppShell title="Uniform Kits">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/kits">Uniform Kits</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">Create New Kit</span>
      </nav>

      <header className="page-head">
        <h1 className="page-head__title">Create New Kit</h1>
        <p className="page-head__subtitle">
          A bundle a school can order as one line. It is never stocked or
          picked as a kit — ordering it adds its components to the order.
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
              placeholder="Primary School Starter Kit"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {/*
            Who the kit is cut for. Four fields rather than four words in the
            kit's name, because AsOne's 2027 catalogue has 120 kits that
            differ by exactly these — and a name cannot be filtered on.

            Leaving the band on "Not stated" is a real choice: it makes a
            general kit, which names its own number and level instead.
          */}
          <div className="field field--stacked">
            <label htmlFor="kit-band">Class Band</label>
            <select
              id="kit-band"
              className="input"
              value={fitGroup}
              onChange={(event) => {
                const next = event.target.value
                setFitGroup(next)
                // Always, not only when the price list moves. The band
                // itself decides which garments may be in the kit, so a
                // Nursery shirt chosen before switching to P5–P7 is now a
                // component the server would refuse.
                setLines([blankLine()])
              }}
            >
              <option value="">Not stated — a general kit</option>
              {KIT_FIT_GROUPS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
            <p className="field__hint">
              {statesCohort
                ? `Which classes wear it. It puts the kit on the ${
                    level === 'PS' ? 'Primary School' : 'High School'
                  } price list.`
                : 'Which classes wear it. Say nothing and the kit is a general one — name its own number and level below.'}
            </p>
          </div>

          {statesCohort && (
            <>
              <div className="field field--stacked">
                <label htmlFor="kit-gender">Gender</label>
                <select
                  id="kit-gender"
                  className="input"
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                >
                  <option value="">Choose…</option>
                  {KIT_GENDERS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field field--stacked">
                <label htmlFor="kit-residence">Day or Boarder</label>
                <select
                  id="kit-residence"
                  className="input"
                  value={residence}
                  onChange={(event) => setResidence(event.target.value)}
                >
                  <option value="">Choose…</option>
                  {KIT_RESIDENCES.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <p className="field__hint">
                  A boarder's kit carries the casual and dorm wear a day pupil
                  goes home for, so the two differ by several components.
                </p>
              </div>

              <div className="field field--stacked">
                <label htmlFor="kit-size">Size</label>
                <select
                  id="kit-size"
                  className="input"
                  value={sizeId ?? ''}
                  onChange={(event) => {
                    setSizeId(event.target.value ? Number(event.target.value) : null)
                    // The size decides which garments may be in the kit, so
                    // anything already chosen is for the old one.
                    setLines([blankLine()])
                  }}
                >
                  <option value="">Choose…</option>
                  {sizes.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.name}
                    </option>
                  ))}
                </select>
                <p className="field__hint">
                  One kit per size. The same bundle in XS and in L are two
                  kits, because they are two sets of garments to make. Only
                  garments in this size, and one-size items like socks, can
                  go in it.
                </p>
              </div>
            </>
          )}

          {/*
            A kit stating a cohort has its number composed from it, the way a
            SKU number is composed — nobody types KIT-NUR-B-DAY-XS. A general
            kit has nothing to compose from, so it is asked for one.
          */}
          {statesCohort ? (
            <div className="field field--stacked">
              <label htmlFor="kit-number">Kit Number</label>
              <div className="input input--locked" id="kit-number">
                <span className="t-numeric">
                  {composedNumber ?? 'Waiting for the fields above'}
                </span>
                <Lock size={14} aria-hidden />
              </div>
              <p className="field__hint">
                Composed by the system from the four fields above — the same
                number AsOne use in their own 2027 workbook, so a kit here and
                a kit on their sheet are the same kit.
              </p>
            </div>
          ) : (
            <>
              <div className="field field--stacked">
                <label htmlFor="kit-number">Kit Number</label>
                <input
                  id="kit-number"
                  className="input"
                  value={kitNumber}
                  placeholder="PS-STARTER-01"
                  onChange={(event) => setKitNumber(event.target.value)}
                />
                <p className="field__hint">
                  Typed by you, because a kit stating no class band has
                  nothing to compose a number from. It only has to be unique.
                </p>
              </div>

              <div className="field field--stacked">
                <label htmlFor="kit-level">Kit Type</label>
                <select
                  id="kit-level"
                  className="input"
                  value={generalLevel}
                  onChange={(event) => {
                    setGeneralLevel(event.target.value)
                    // The old lines belong to the old level, and the server
                    // refuses a Primary kit holding a High-School garment.
                    setLines([blankLine()])
                  }}
                >
                  {LEVELS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <p className="field__hint">
                  A kit belongs to one level. Changing it clears the components,
                  because a Primary kit cannot hold a High-School garment.
                </p>
              </div>
            </>
          )}

          <div className="field field--stacked">
            <label htmlFor="kit-description">Description</label>
            <textarea
              id="kit-description"
              className="input input--area"
              rows={3}
              value={description}
              placeholder="Who this kit is for, in a sentence."
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
              Only active kits can be added to a new order. A kit is
              deactivated, never deleted.
            </p>
          </div>
        </section>

        <section className="card-panel compose__lines">
          <div className="card-panel__head">
            <h2 className="card-panel__title card-panel__title--accent">Kit Components</h2>
            <Button size="sm" onClick={() => setLines((prior) => [...prior, blankLine()])}>
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
                {lines.map((line, index) => {
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
                            // One line per SKU — the server has a unique
                            // constraint, and two rows would split the
                            // quantity across them.
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
                              quantity: Math.max(1, Math.round(Number(event.target.value) || 1)),
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
              {incomplete.length === 1
                ? 'One line has no item chosen. Pick one, or remove the row.'
                : `${incomplete.length} lines have no item chosen. Pick them, or remove the rows.`}
            </p>
          )}

          {unpriced.length > 0 && (
            <p className="callout callout--warning">
              {unpriced.length === 1 ? 'One item has' : `${unpriced.length} items have`} no
              price today, so this kit will have no total until they are priced. It can
              still be created.
            </p>
          )}

          <p className="field__hint">
            The kit price is the sum of these lines at today's prices. A kit has
            no price of its own and carries no bundle discount, so there is
            nothing to type here.
          </p>
        </section>
      </div>

      {/* Error, not warning. Nothing was written and nothing will be until
          the named row is fixed. */}
      {refused && <Alert tone="error">{refused}</Alert>}

      {createKit.isError && !refused && (
        <Alert tone="error">
          <strong>The kit was not created.</strong>{' '}
          {toApiError(createKit.error).message}
        </Alert>
      )}

      <div className="compose__bar">
        <div className="compose__summary">
          {/* Names the step that is actually missing. "Add at least one
              item" while a row sits on screen waiting for one reads as a bug
              in the form rather than an instruction. */}
          <p className="compose__count">
            {name.trim() === ''
              ? 'Give the kit a name.'
              : cohortIncomplete
                ? 'Say the gender, the residence and the size — the kit number is built from them.'
                : !numbered
                  ? 'Give the kit a number.'
                  : incomplete.length > 0
                    ? 'Choose an item for every line.'
                    : `${totalUnits} items across ${lines.length} line${lines.length === 1 ? '' : 's'}`}
          </p>
          {totalUnits > 0 && unpriced.length === 0 && (
            <p className="compose__total">
              <span>Kit price</span>
              <strong className="t-numeric">{formatUGX(estimate)}</strong>
            </p>
          )}
        </div>

        <div className="compose__actions">
          <Button variant="secondary" onClick={() => navigate('/kits')} disabled={saving}>
            Cancel
          </Button>
          <Button disabled={!ready} onClick={submit}>
            {saving ? 'Creating…' : 'Create Kit'}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
