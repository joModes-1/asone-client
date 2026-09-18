/**
 * Edit a SKU — its description, and whether it can still be ordered.
 *
 * ---------------------------------------------------------------------------
 * Two fields, and the two that are missing matter more
 * ---------------------------------------------------------------------------
 * **Garment and size cannot be changed.** A SKU *is* one garment in one size,
 * and its number is composed from the pair — BTU-8 is this garment, size 8.
 * That number is printed on pick lists and packing lists and must go on
 * meaning the same product forever, so changing either half would quietly
 * make an existing number name something else. A SKU built on the wrong
 * garment is deactivated and the right one created; the wrong one keeps its
 * history.
 *
 * **Stock is not here either.** A quantity typed on an edit form is stock
 * with no movement behind it. Changing what is on the shelf is an
 * adjustment, with a reason code and a name against it — which is what the
 * other button on this panel goes to.
 *
 * ---------------------------------------------------------------------------
 * The minimum, which is here, and why that is not a contradiction
 * ---------------------------------------------------------------------------
 * The minimum is not stock. It is the floor somebody decided this warehouse
 * should not go below — a judgement about the SKU, not a claim about the
 * shelf — so typing it moves nothing and needs no ledger row.
 *
 * It had to be added because it could only ever be set **once**, on the
 * Create SKU form, and nothing in the app could change it afterwards. A
 * threshold keyed wrong on the day a SKU was created was permanent: the
 * reorder alert and the dashboard's Needs Attention are both derived from it,
 * so the wrong number meant either a warning nobody could silence or a SKU
 * that would never warn at all.
 *
 * It is per warehouse, because the two serve different numbers of schools, so
 * this edits the floor at **the warehouse whose row was opened** and says so
 * on the label. The other warehouse's floor is edited from its own row.
 */

import { useState, type FormEvent } from 'react'
import { Alert, Button, Modal, TextField, snackbar } from '@/components'
import { toApiError } from '@/api/errors'
import { formatQuantity } from '@/domain/money'
import { useSaveMinimum } from '../hooks/useSaveMinimum'
import { useUpdateSku } from '../hooks/useUpdateSku'
import type { InventoryRow } from '../hooks/useInventoryRows'

interface EditSkuModalProps {
  open: boolean
  onClose: () => void
  row: InventoryRow | null
}

export function EditSkuModal({ open, onClose, row }: EditSkuModalProps) {
  const save = useUpdateSku(row?.skuId ?? 0)
  const saveMinimum = useSaveMinimum()
  const error = save.error
    ? toApiError(save.error)
    : saveMinimum.error
      ? toApiError(saveMinimum.error)
      : null
  const pending = save.isPending || saveMinimum.isPending

  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [minimum, setMinimum] = useState('')
  const [loadedFor, setLoadedFor] = useState<number | null>(null)

  /*
   * Fill the form from the row the panel is showing, and refill it when the
   * panel moves to a different SKU. Done during render rather than in an
   * effect — the documented way to derive state from a prop that changes —
   * so the dialogue never shows the previous SKU's description for a frame.
   */
  if (row && loadedFor !== row.skuId) {
    setLoadedFor(row.skuId)
    setDescription(row.description)
    setIsActive(row.isActive)
    /* Empty, not "0", when there is no floor. Zero is a floor of zero — a
       SKU that may run empty without complaint — and that is a different
       statement from never having set one. */
    setMinimum(row.minimumQuantity === null ? '' : String(row.minimumQuantity))
    save.reset()
    saveMinimum.reset()
  }

  function close() {
    setLoadedFor(null)
    save.reset()
    saveMinimum.reset()
    onClose()
  }

  /*
   * Two writes, and the SKU goes first.
   *
   * They are separate rows on the server and there is no endpoint that sets
   * both, so this cannot be one request. Order matters for what a failure
   * leaves behind: if the minimum fails after the SKU saved, the SKU's own
   * edit stands and the message names the part that did not — which is
   * recoverable. The other way round, a saved minimum with a failed
   * description is the same amount of work to explain and harder to see.
   *
   * The minimum is skipped entirely when the field is untouched, so opening
   * this dialogue to fix a typo does not write a threshold row that did not
   * exist before.
   */
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!row) return

    const typed = minimum.trim()
    const changed = typed !== (row.minimumQuantity === null ? '' : String(row.minimumQuantity))

    save.mutate(
      { description: description.trim(), is_active: isActive },
      {
        onSuccess: () => {
          if (!changed || typed === '') {
            close()
            return
          }

          saveMinimum.mutate(
            {
              minimumId: row.minimumId,
              skuId: row.skuId,
              warehouseId: row.warehouseId,
              minimumQuantity: Number(typed),
            },
            {
              onSuccess: () => {
                snackbar.success(
                  `Minimum set to ${formatQuantity(Number(typed))}`,
                  `${row.skuNumber} at ${row.warehouseName}.`,
                )
                close()
              },
            },
          )
        },
      },
    )
  }

  if (!row) return null

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Edit ${row.skuNumber}`}
      subtitle="The description, its minimum here, and whether it can still be ordered."
      size="sm"
      footer={
        <div className="modal__foot-actions">
          <Button variant="secondary" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="edit-sku-form" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      }
    >
      <form id="edit-sku-form" className="stack-form" onSubmit={submit} noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}

        {/*
          Shown, not editable, and said plainly — somebody opening this
          expecting to fix a wrong garment needs to know why they cannot,
          rather than hunting for a field that is not there.
        */}
        <p className="modal-form__fact">
          <span>Garment and size</span>
          <span className="modal-form__swatch-value">
            {row.garmentName} · {row.sizeName}
          </span>
        </p>
        <p className="field__hint">
          Neither can be changed: {row.skuNumber} is composed from them and is
          printed on pick lists. A SKU built on the wrong garment is
          deactivated and the right one created.
        </p>

        <TextField
          label="Description"
          value={description}
          autoFocus
          error={error?.fields?.description?.[0]}
          onChange={(event) => setDescription(event.target.value)}
        />

        <TextField
          label={`Minimum at ${row.warehouseName}`}
          type="number"
          min={0}
          value={minimum}
          error={error?.fields?.minimum_quantity?.[0]}
          onChange={(event) => setMinimum(event.target.value)}
        />
        <p className="field__hint">
          {row.minimumQuantity === null
            ? 'No floor is set here, so this SKU is never reported as low however far it falls. Enter one to start watching it.'
            : `Available is ${formatQuantity(row.available)} today. The quantity turns amber at or below this number, and it is what the reorder alert and the dashboard count as low.`}
        </p>

        <div className="field field--stacked">
          <label className="kit-toggle">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>Can be ordered</span>
          </label>
          <p className="field__hint">
            A retired SKU stays in every report and on every past order — it
            just cannot be added to a new one, or to a kit.
          </p>
        </div>
      </form>
    </Modal>
  )
}
