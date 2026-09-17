/**
 * Add a garment, and add a size — the two things a SKU is built from.
 *
 * Both endpoints existed with no way in from the app, so Create New SKU
 * could ask for a garment that did not exist and offer no way to make one.
 * The only route was the Django admin, which is not a route a lead has.
 *
 * ---------------------------------------------------------------------------
 * A garment is not stock
 * ---------------------------------------------------------------------------
 * It is a uniform component before a size is chosen — "White Shirt". A
 * garment in one size is a SKU, and that is what is counted and picked. The
 * form says so, because the two words are easy to swap.
 *
 * Price is not here. It hangs off the garment rather than the SKU, so that
 * every size of a shirt costs the same by construction — but setting it is
 * Pricing's job, and a price is dated rather than a number you type once.
 */

import { useState, type FormEvent } from 'react'
import { Palette } from 'lucide-react'
import { Alert, Button, Modal, Select, TextField } from '@/components'
import * as catalogApi from '@/api/catalog'
import { toApiError } from '@/api/errors'
import { todayISO } from '@/domain/dates'
import type { Garment, GarmentSchoolLevel } from '@/api/types'
import { GARMENT_COLOURS, garmentSwatch, isKnownColour } from '@/domain/garmentColours'
import { cleanSizeName } from '@/domain/sizes'
import { useCreateGarment, useCreateSize, useUpdateGarment } from '../hooks/useCreateGarment'

/**
 * A `var(--token)` resolved to the hex behind it.
 *
 * The presets are tokens, as every colour in this app is — but
 * `<input type="color">` only accepts a literal `#rrggbb`, so picking a
 * preset has to read the value the token currently holds.
 */
function resolveToken(token: string): string {
  const name = token.match(/var\((--[^)]+)\)/)?.[1]
  if (!name || typeof document === 'undefined') return token
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || token
}

interface CreateGarmentModalProps {
  open: boolean
  onClose: () => void
}

export function CreateGarmentModal({ open, onClose }: CreateGarmentModalProps) {
  const save = useCreateGarment()
  const error = save.error ? toApiError(save.error) : null
  const [partial, setPartial] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [level, setLevel] = useState<GarmentSchoolLevel>('BOTH')
  const [colour, setColour] = useState('')
  // Empty means "no swatch chosen", which screens draw as a neutral rather
  // than as white — white is a real uniform colour.
  const [hex, setHex] = useState('')
  const [price, setPrice] = useState('')

  const ready = name.trim() !== '' && price.trim() !== '' && !save.isPending

  function reset() {
    setName('')
    setLevel('BOTH')
    setColour('')
    setHex('')
    setPrice('')
    save.reset()
    setPartial(null)
  }

  function close() {
    reset()
    onClose()
  }

  /*
   * Two calls, reported as one.
   *
   * Creating a garment does not take a price — `reprice` is a separate
   * action, because changing a price closes one dated period and opens
   * another and that is not something a create can express. So the garment
   * is created first and priced immediately after.
   *
   * Those can half-succeed, and a garment with no price is worse than no
   * garment at all: `price_for()` raises, so every SKU beneath it cannot be
   * ordered, the kit total refuses to compute, and nothing on screen says
   * why. If the second call fails the first is not hidden — the garment
   * exists, and the message says it needs a price.
   */
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return

    setPartial(null)
    try {
      const garment = await save.mutateAsync({
        name: name.trim(),
        school_level: level,
        colour: colour.trim(),
        colour_hex: hex,
      })

      try {
        await catalogApi.reprice(garment.id, {
          unit_price: price.trim(),
          active_from: todayISO(),
        })
      } catch (cause) {
        setPartial(
          `${garment.name} was created, but its price was not set: ${
            toApiError(cause).message
          } Until it has one, nothing beneath it can be ordered.`,
        )
        return
      }

      close()
    } catch {
      // The garment itself failed; `save.error` already says why.
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New garment"
      subtitle="A uniform component before a size is chosen — the thing SKUs are made of."
      size="md"
      footer={
        <div className="modal__foot-actions">
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-garment-form"
            disabled={!ready}
          >
            {save.isPending ? 'Adding…' : 'Add garment'}
          </Button>
        </div>
      }
    >
      <form id="create-garment-form" className="stack-form" onSubmit={submit} noValidate>
        {partial ? (
          <Alert tone="warning">
            <strong>Half done.</strong> {partial}
          </Alert>
        ) : (
          error && <Alert tone="error">{error.message}</Alert>
        )}

        <TextField
          label="Name"
          value={name}
          autoFocus
          required
          placeholder="White Shirt"
          error={error?.fields?.name?.[0]}
          onChange={(event) => setName(event.target.value)}
        />

        <Select
          label="School level"
          value={level}
          onChange={(event) => setLevel(event.target.value as GarmentSchoolLevel)}
        >
          <option value="BOTH">Both — appears on either price list</option>
          <option value="PS">Primary only</option>
          <option value="HS">High School only</option>
        </Select>

        {/*
          The swatches set the colour *name*, which is what the server
          stores and what the SKU description reads — they are not a second
          field. Picking one is the quick path; the text field stays because
          `Garment.colour` is free text and AsOne may have a shade with no
          dot of its own.

          The dot beside the field is drawn from whatever the name says, so
          typing and picking always agree.
        */}
        <div className="field field--stacked">
          <span className="field__label">Colour</span>

          <div className="swatch-picker" role="group" aria-label="Garment colour">
            {GARMENT_COLOURS.map((entry) => {
              const chosen = colour.trim().toLowerCase() === entry.name.toLowerCase()
              return (
                <button
                  key={entry.name}
                  type="button"
                  className={`swatch-picker__dot${chosen ? ' swatch-picker__dot--on' : ''}`}
                  style={{ background: entry.token }}
                  aria-label={entry.name}
                  aria-pressed={chosen}
                  title={entry.name}
                  onClick={() => {
                    setColour(chosen ? '' : entry.name)
                    // A preset carries its own swatch, so the picker follows
                    // rather than being left on whatever was there before.
                    setHex(chosen ? '' : resolveToken(entry.token))
                  }}
                />
              )
            })}

            {/*
              Anything else. The presets are the uniforms AsOne has today;
              this is for the one nobody anticipated — a purple, a mustard.
              The native control gives a real hue/saturation picker for free
              and is the one every operating system already knows how to
              show, including on a phone.
            */}
            <label className="swatch-picker__custom" title="Any other colour">
              <input
                type="color"
                aria-label="Pick any colour"
                value={hex || '#5e8e8e'}
                onChange={(event) => setHex(event.target.value)}
              />
              <Palette size={14} aria-hidden />
            </label>
          </div>

          <TextField
            label="Colour name"
            value={colour}
            placeholder="White"
            trailing={
              <span
                className="swatch-picker__preview"
                style={{ background: hex || garmentSwatch(colour) }}
                aria-hidden
              />
            }
            onChange={(event) => setColour(event.target.value)}
          />
          <p className="field__hint">
            Optional. It belongs to the garment rather than the SKU — every
            size of this garment is this colour.
          </p>

          {/*
            Said plainly rather than shown as a wrong dot. A colour the app
            has no swatch for still saves and still reads on every screen;
            only the dot is missing, and a grey one is honest about that
            where a white one would claim the garment is white.
          */}
          {colour.trim() !== '' && hex === '' && !isKnownColour(colour) && (
            <p className="field__hint">
              No swatch for “{colour.trim()}” yet, so its dot shows as grey.
              The name is used everywhere regardless.
            </p>
          )}
        </div>

        <div className="field field--stacked">
          <TextField
            label="Price (UGX)"
            type="number"
            min={0}
            step="0.01"
            required
            value={price}
            placeholder="25000"
            onChange={(event) => setPrice(event.target.value)}
          />
          {/*
            Required, not optional.

            A garment with no price cannot be ordered at all — `price_for()`
            raises, so every SKU beneath it refuses to cost, the kit total
            refuses to compute, and nothing on screen explains why. Creating
            one unpriced is creating something broken.
          */}
          <p className="field__hint">
            Applies from today, and to every size of this garment — price
            belongs to the garment, not the SKU. Changing it later opens a new
            dated period rather than rewriting this one.
          </p>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Where a size falls in the order, worked out rather than asked for.
 *
 * Sizes do not sort as text — "10" comes before "8" — and pick lists read in
 * size order, so the server keeps an explicit `sort_order`. But for a
 * numeric size that number *is* the size, and asking somebody to type 10
 * twice is a field that can only be got wrong.
 *
 * A name with no number in it — S, M, L — sorts after the numbered ones
 * rather than silently at 0, which would put "S" before size 8. Those are
 * rare enough to reorder in the admin if AsOne ever needs them in sequence.
 */
function sortOrderFor(name: string): number {
  const digits = name.match(/\d+/)
  return digits ? Number(digits[0]) : 1000
}


interface CreateSizeModalProps {
  open: boolean
  onClose: () => void
}

export function CreateSizeModal({ open, onClose }: CreateSizeModalProps) {
  const save = useCreateSize()
  const error = save.error ? toApiError(save.error) : null

  const [name, setName] = useState('')

  function close() {
    setName('')
    save.reset()
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const clean = cleanSizeName(name)
    if (!clean) return
    save.mutate({ name: clean, sort_order: sortOrderFor(clean) }, { onSuccess: close })
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New size"
      subtitle="Shared across garments, so “10” means one thing everywhere."
      size="sm"
      footer={
        <div className="modal__foot-actions">
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-size-form"
            disabled={!cleanSizeName(name) || save.isPending}
          >
            {save.isPending ? 'Adding…' : 'Add size'}
          </Button>
        </div>
      }
    >
      <form id="create-size-form" className="stack-form" onSubmit={submit} noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}

        <div className="field field--stacked">
          <TextField
            label="Name"
            value={name}
            autoFocus
            required
            placeholder="10"
            error={error?.fields?.name?.[0]}
            onChange={(event) => setName(event.target.value)}
          />
          {/*
            Just the value, not "Size 10".
            
            The server composes a SKU's description as `… size {name}`, and
            the pickers prefix the word themselves — so a size stored as
            "Size 10" reads "size Size 10" on every pick list and packing
            list. Said here because typing the word is the obvious thing to
            do and the consequence is invisible until something is printed.
          */}
          <p className="field__hint">
            The value on its own — “10”, “S”, “E2E-12”. The word “size” is
            added wherever this is shown, so it is taken off here if you type
            it.
          </p>

          {/* Shown only when it would differ, so the person can see what is
              actually going to be stored before they commit to it. */}
          {cleanSizeName(name) !== name.trim() && name.trim() !== '' && (
            <p className="field__hint">
              Will be saved as <strong>{cleanSizeName(name) || '—'}</strong>.
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}

/**
 * Edit a garment — name, level, colour, and whether it can still be used.
 *
 * Price is not here. Changing one closes a dated period and opens another,
 * which is a different action with its own dialogue and its own history —
 * folding it into a general edit form would make it look like a field you
 * overwrite, which is the one thing it must not look like.
 *
 * The code is not here either: it is frozen at creation, because every SKU
 * beneath the garment is numbered from it and those numbers are printed.
 */
export function EditGarmentModal({
  open,
  garment,
  onClose,
}: {
  open: boolean
  garment: Garment | null
  onClose: () => void
}) {
  const save = useUpdateGarment(garment?.id ?? 0)
  const error = save.error ? toApiError(save.error) : null

  const [name, setName] = useState('')
  const [level, setLevel] = useState<GarmentSchoolLevel>('BOTH')
  const [colour, setColour] = useState('')
  const [hex, setHex] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loadedFor, setLoadedFor] = useState<number | null>(null)

  /* Filled from the row, and refilled when the dialogue moves to another
     garment — during render, so it never shows the previous one's name. */
  if (garment && loadedFor !== garment.id) {
    setLoadedFor(garment.id)
    setName(garment.name)
    setLevel((garment.school_level as GarmentSchoolLevel) ?? 'BOTH')
    setColour(garment.colour ?? '')
    setHex(garment.colour_hex ?? '')
    setIsActive(garment.is_active !== false)
    save.reset()
  }

  function close() {
    setLoadedFor(null)
    save.reset()
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    save.mutate(
      {
        name: name.trim(),
        school_level: level,
        colour: colour.trim(),
        colour_hex: hex,
        is_active: isActive,
      },
      { onSuccess: close },
    )
  }

  if (!garment) return null

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Edit ${garment.name}`}
      subtitle={`Code ${garment.code} — frozen, because every SKU beneath it is numbered from it.`}
      size="md"
      footer={
        <div className="modal__foot-actions">
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-garment-form"
            disabled={!name.trim() || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      }
    >
      <form id="edit-garment-form" className="stack-form" onSubmit={submit} noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}

        <TextField
          label="Name"
          value={name}
          autoFocus
          required
          error={error?.fields?.name?.[0]}
          onChange={(event) => setName(event.target.value)}
        />

        <Select
          label="School level"
          value={level}
          onChange={(event) => setLevel(event.target.value as GarmentSchoolLevel)}
        >
          <option value="BOTH">Both — appears on either price list</option>
          <option value="PS">Primary only</option>
          <option value="HS">High School only</option>
        </Select>

        <div className="field field--stacked">
          <span className="field__label">Colour</span>
          <div className="swatch-picker" role="group" aria-label="Garment colour">
            {GARMENT_COLOURS.map((entry) => {
              const chosen = colour.trim().toLowerCase() === entry.name.toLowerCase()
              return (
                <button
                  key={entry.name}
                  type="button"
                  className={`swatch-picker__dot${chosen ? ' swatch-picker__dot--on' : ''}`}
                  style={{ background: entry.token }}
                  aria-label={entry.name}
                  aria-pressed={chosen}
                  title={entry.name}
                  onClick={() => {
                    setColour(chosen ? '' : entry.name)
                    setHex(chosen ? '' : resolveToken(entry.token))
                  }}
                />
              )
            })}
            <label className="swatch-picker__custom" title="Any other colour">
              <input
                type="color"
                aria-label="Pick any colour"
                value={hex || '#5e8e8e'}
                onChange={(event) => setHex(event.target.value)}
              />
              <Palette size={14} aria-hidden />
            </label>
          </div>

          <TextField
            label="Colour name"
            value={colour}
            trailing={
              <span
                className="swatch-picker__preview"
                style={{ background: hex || garmentSwatch(colour) }}
                aria-hidden
              />
            }
            onChange={(event) => setColour(event.target.value)}
          />
        </div>

        <div className="field field--stacked">
          <label className="kit-toggle">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>Can be used</span>
          </label>
          <p className="field__hint">
            A retired garment stays on every past order and in every report —
            it just cannot have new SKUs built on it, and its existing SKUs
            cannot be added to a new order.
          </p>
        </div>
      </form>
    </Modal>
  )
}
