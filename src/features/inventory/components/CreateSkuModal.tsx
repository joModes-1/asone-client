/**
 * Create New SKU.
 *
 * Two writes under one form: the SKU itself, then a `MinimumStockLevel` per
 * warehouse the lead actually filled a threshold in for — see `useCreateSku`.
 *
 * The visual language here (radio pills, the swatch dot, the boxed preview
 * at the bottom, the footer toggle) matches the reference design; two parts
 * of the reference assumed data this system doesn't have, so the box and the
 * field are real rather than looking real:
 *
 *   - The bottom box read "GENERATED SKU SYSTEM PREVIEW" with a fabricated
 *     code (`UNI-PS-WS-08-W`). There is no such code — `Sku.number` is a
 *     bare sequential control number from a Postgres sequence
 *     (`catalog/services.py: next_sku_number`), unrelated to garment,
 *     level, size or colour. The box stays; what it says is honest instead.
 *   - Color was a free dropdown of five names, independent of which garment
 *     was picked. Colour lives on `Garment`, not `Sku` — there is no second
 *     colour a SKU could have besides its garment's own. Picking "Maroon"
 *     for a white garment wouldn't fail, it would just be untrue. The swatch
 *     dot stays; the field now only ever shows the chosen garment's real
 *     colour.
 */

import { useState, type FormEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { Alert, Button, Modal } from '@/components'
import { toApiError } from '@/api/errors'
import { swatchFor } from '@/domain/garmentColours'
import { useCreateSku } from '../hooks/useCreateSku'
import { useGarmentOptions } from '../hooks/useGarmentOptions'
import { useSizeOptions } from '../hooks/useSizeOptions'
import { useWarehouseOptions } from '@/features/catalog/hooks/useWarehouseOptions'
import type { GarmentSchoolLevel, Sku } from '@/api/types'

const FORM_ID = 'create-sku-form'

interface CreateSkuModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (sku: Sku) => void
}

/**
 * The garment's code, as the server assigned it.
 *
 * This used to be guessed here — "White Shirt" became "WS" — which
 * disagreed with the real code the server stores ("WSH"), so the dropdown
 * showed one code and every SKU beneath the garment carried another.
 */
function garmentCode(garment: { code?: string; name: string }): string {
  return garment.code ?? ''
}

/** Mirrors Sku.build_description on the server */
function describe(garmentName: string, colour: string, level: string, sizeName: string): string {
  const parts = [garmentName]
  if (colour) parts.push(colour)
  parts.push(`size ${sizeName}`)
  let label = parts.join(' ')
  if (level !== 'BOTH') label = `${label} (${level})`
  return label
}

export function CreateSkuModal({ isOpen, onClose, onSuccess }: CreateSkuModalProps) {
  const { garments } = useGarmentOptions()
  const { sizes } = useSizeOptions()
  const { warehouses } = useWarehouseOptions()

  const [levelFilter, setLevelFilter] = useState<GarmentSchoolLevel>('PS')
  const [garmentId, setGarmentId] = useState('')
  const [sizeId, setSizeId] = useState('')
  const [descriptionOverride, setDescriptionOverride] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [minimums, setMinimums] = useState<Record<number, string>>({})

  const save = useCreateSku()
  const error = save.error ? toApiError(save.error) : null

  const visibleGarments = garments.filter(
    (g) => g.school_level === levelFilter || g.school_level === 'BOTH',
  )
  const garment = garments.find((g) => String(g.id) === garmentId) ?? null
  const size = sizes.find((s) => String(s.id) === sizeId) ?? null
  const canSubmit = Boolean(garmentId && sizeId) && !save.isPending

  // Colour is the garment's own — never independently chosen (see the
  // module comment). Blank until a garment is picked, not "White": a
  // silent default would show a colour that may not be this SKU's.
  const effectiveColor = garment?.colour ?? ''

  const computedDescription =
    garment && size
      ? describe(garment.name, effectiveColor, garment.school_level ?? 'BOTH', size.name)
      : ''
  const description = descriptionOverride ?? computedDescription

  function handleLevelChange(next: GarmentSchoolLevel) {
    setLevelFilter(next)
    if (garment && garment.school_level !== next && garment.school_level !== 'BOTH') {
      setGarmentId('')
    }
  }

  function handleReset() {
    setLevelFilter('PS')
    setGarmentId('')
    setSizeId('')
    setDescriptionOverride(null)
    setIsActive(true)
    setMinimums({})
    save.reset()
  }

  function handleClose() {
    handleReset()
    onClose()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!garment || !size) return

    const minimumEntries = Object.entries(minimums)
      .map(([warehouseId, value]) => ({
        warehouseId: Number(warehouseId),
        quantity: Number(value),
      }))
      .filter(
        (entry) =>
          entry.quantity >= 0 &&
          !Number.isNaN(entry.quantity) &&
          minimums[Number(entry.warehouseId)] !== '',
      )

    save.mutate(
      {
        garment: garment.id,
        size: size.id,
        description: description.trim() || undefined,
        isActive,
        minimums: minimumEntries,
      },
      {
        onSuccess: (sku) => {
          handleClose()
          onSuccess?.(sku)
        },
      },
    )
  }

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Create New SKU"
      subtitle="Define uniform parameters to generate a unique system identifier."
      size="md"
      footer={
        <div className="create-sku-modal__footer-row">
          <label className="create-sku-modal__toggle">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="create-sku-modal__toggle-track" aria-hidden />
            <span className="create-sku-modal__toggle-label">SKU Active</span>
          </label>

          <div className="create-sku-modal__btn-actions">
            <Button variant="secondary" onClick={handleClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} disabled={!canSubmit}>
              {save.isPending ? 'Creating…' : 'Create SKU'}
            </Button>
          </div>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="create-sku-form">
        {/*
         * Always, not `!error.fields` — this form has no per-field inline
         * error display, so a garment+size uniqueness violation (which
         * arrives under `non_field_errors`, not tied to one input) would
         * otherwise be silently swallowed. Confirmed by triggering one.
         */}
        {error && <Alert tone="error">{error.message}</Alert>}

        <p className="create-sku-form__section-title">BASIC INFORMATION</p>

        <div className="create-sku-form__field">
          <label htmlFor="sku-garment" className="create-sku-form__label">
            Garment Type
          </label>
          <div className="create-sku-form__select-wrapper">
            <select
              id="sku-garment"
              className="input create-sku-form__select"
              value={garmentId}
              onChange={(e) => setGarmentId(e.target.value)}
              required
              autoFocus
            >
              <option value="" disabled>
                Choose a garment…
              </option>
              {visibleGarments.map((g) => (
                <option key={g.id} value={g.id}>
                  {garmentCode(g) ? `${g.name} (${garmentCode(g)})` : g.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="create-sku-form__chevron" aria-hidden />
          </div>
        </div>

        <div className="create-sku-form__field">
          <label htmlFor="sku-description" className="create-sku-form__label">
            Garment Description
          </label>
          <input
            id="sku-description"
            type="text"
            className="input create-sku-form__input"
            value={description}
            onChange={(e) => setDescriptionOverride(e.target.value)}
            placeholder="Short sleeve collared primary school uniform shirt"
          />
        </div>

        <div className="create-sku-form__row-split">
          <div className="create-sku-form__field">
            <span className="create-sku-form__label">School Level</span>
            <div
              className="create-sku-form__radio-group"
              role="radiogroup"
              aria-label="School level"
            >
              <button
                type="button"
                role="radio"
                aria-checked={levelFilter === 'PS'}
                className={`create-sku-form__radio-pill ${
                  levelFilter === 'PS' ? 'create-sku-form__radio-pill--active' : ''
                }`}
                onClick={() => handleLevelChange('PS')}
              >
                <span className="create-sku-form__radio-dot" />
                Primary (PS)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={levelFilter === 'HS'}
                className={`create-sku-form__radio-pill ${
                  levelFilter === 'HS' ? 'create-sku-form__radio-pill--active' : ''
                }`}
                onClick={() => handleLevelChange('HS')}
              >
                <span className="create-sku-form__radio-dot" />
                High (HS)
              </button>
            </div>
          </div>

          <div className="create-sku-form__field">
            <label htmlFor="sku-size" className="create-sku-form__label">
              Size
            </label>
            <div className="create-sku-form__select-wrapper">
              <select
                id="sku-size"
                className="input create-sku-form__select"
                value={sizeId}
                onChange={(e) => setSizeId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Choose a size…
                </option>
                {sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name.toLowerCase().startsWith('size') ? s.name : `Size ${s.name}`}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="create-sku-form__chevron" aria-hidden />
            </div>
          </div>
        </div>

        <div className="create-sku-form__field">
          <label htmlFor="sku-color" className="create-sku-form__label">
            Color
          </label>
          <div className="create-sku-form__select-wrapper">
            <span
              className="create-sku-form__color-indicator"
              style={{ backgroundColor: garment ? swatchFor(garment) : 'var(--garment-unknown)' }}
            />
            <select
              id="sku-color"
              className="input create-sku-form__select create-sku-form__select--with-swatch"
              value={effectiveColor}
              disabled
              title="Set on the garment itself, not chosen per SKU — see Garments."
            >
              <option value={effectiveColor}>
                {effectiveColor
                  ? `${effectiveColor} (${effectiveColor[0].toUpperCase()})`
                  : 'Choose a garment first…'}
              </option>
            </select>
            <ChevronDown size={14} className="create-sku-form__chevron" aria-hidden />
          </div>
        </div>

        <p className="create-sku-form__section-title">SAFETY STOCK THRESHOLDS</p>

        <div className="create-sku-form__row-split">
          {warehouses.map((warehouse, idx) => {
            const cleanName = warehouse.name.replace(/Warehouse/i, 'Hub').trim()
            const labelText = cleanName.includes('Min') ? cleanName : `${cleanName} Min.`
            return (
              <div className="create-sku-form__field" key={warehouse.id}>
                <label htmlFor={`sku-min-${warehouse.id}`} className="create-sku-form__label">
                  {labelText}
                </label>
                <input
                  id={`sku-min-${warehouse.id}`}
                  type="number"
                  min={0}
                  className="input create-sku-form__input"
                  placeholder={idx === 0 ? '50' : '30'}
                  value={minimums[warehouse.id] ?? ''}
                  onChange={(e) =>
                    setMinimums((current) => ({ ...current, [warehouse.id]: e.target.value }))
                  }
                />
              </div>
            )
          })}
        </div>

        {/*
          The real code, not a promise of one.

          A SKU number is derived — the garment's code, then the size — so it
          can be shown before the save rather than after. This read "System
          control number — assigned on save", which was true of the old
          sequence numbers and has not been since.
        */}
        <div className="create-sku-form__preview-box">
          <p className="create-sku-form__preview-label">GENERATED SKU SYSTEM PREVIEW</p>
          <p className="create-sku-form__preview-code">
            {garment?.code && size
              ? `${garment.code}-${size.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`
              : 'Choose a garment and a size'}
          </p>
        </div>
      </form>
    </Modal>
  )
}
