/**
 * Adding a warehouse, and adding a tailoring centre.
 *
 * Two small dialogues rather than one screen each: a site is a name, an
 * address and — for a warehouse — which centre usually supplies it. There is
 * nothing here that needs a page of its own.
 *
 * ---------------------------------------------------------------------------
 * What is deliberately not asked for
 * ---------------------------------------------------------------------------
 * **Stock.** A warehouse starts empty and the only honest way to put stock
 * in it is a receipt against a production order, or an imported count. A
 * quantity typed at creation would be inventory with no movement behind it,
 * which is the one thing the ledger exists to prevent.
 *
 * **Active.** Both are created active. Deactivating is a decision taken
 * later, about a site that has served its purpose, and offering it here
 * invites a site that exists but does nothing.
 */

import { useState, type FormEvent } from 'react'
import { Alert, Button, Modal, Select, TextField } from '@/components'
import { toApiError } from '@/api/errors'
import type { TailoringCenter } from '@/api/types'
import { useCreateTailoringCenter, useCreateWarehouse } from '../hooks/useSaveSite'

interface AddWarehouseModalProps {
  open: boolean
  onClose: () => void
  /** Offered as the supplying centre. Empty is fine — it can be set later. */
  tailoringCenters: TailoringCenter[]
}

export function AddWarehouseModal({
  open,
  onClose,
  tailoringCenters,
}: AddWarehouseModalProps) {
  const save = useCreateWarehouse()
  const error = save.error ? toApiError(save.error) : null

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [centre, setCentre] = useState('')

  function close() {
    setName('')
    setAddress('')
    setCentre('')
    save.reset()
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    save.mutate(
      {
        name: name.trim(),
        address: address.trim(),
        // Null rather than omitted: the field is genuinely "none yet", and
        // an omitted field means "leave it alone" on a PATCH.
        primary_tailoring_center: centre ? Number(centre) : null,
      },
      { onSuccess: close },
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New warehouse"
      subtitle="A site that holds stock and ships to the schools around it."
      size="sm"
      footer={
        <div className="modal__foot-actions">
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-warehouse-form"
            disabled={!name.trim() || save.isPending}
          >
            {save.isPending ? 'Adding…' : 'Add warehouse'}
          </Button>
        </div>
      }
    >
      <form id="add-warehouse-form" className="stack-form" onSubmit={submit} noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}

        <TextField
          label="Name"
          value={name}
          autoFocus
          required
          placeholder="Namayemba"
          error={error?.fields?.name?.[0]}
          onChange={(event) => setName(event.target.value)}
        />

        <TextField
          label="Address"
          value={address}
          placeholder="Optional"
          onChange={(event) => setAddress(event.target.value)}
        />

        <div className="field field--stacked">
          <Select
            label="Primary tailoring centre"
            value={centre}
            onChange={(event) => setCentre(event.target.value)}
          >
            <option value="">None yet</option>
            {tailoringCenters.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
          <p className="field__hint">
            Who usually makes this warehouse&apos;s garments. A production
            order can still be placed with any centre — this is the default,
            not a restriction.
          </p>
        </div>
      </form>
    </Modal>
  )
}

interface AddTailoringCenterModalProps {
  open: boolean
  onClose: () => void
}

export function AddTailoringCenterModal({ open, onClose }: AddTailoringCenterModalProps) {
  const save = useCreateTailoringCenter()
  const error = save.error ? toApiError(save.error) : null

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  function close() {
    setName('')
    setAddress('')
    save.reset()
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    save.mutate({ name: name.trim(), address: address.trim() }, { onSuccess: close })
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New tailoring centre"
      subtitle="Who makes the garments. Centres are not users of this system."
      size="sm"
      footer={
        <div className="modal__foot-actions">
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-tc-form"
            disabled={!name.trim() || save.isPending}
          >
            {save.isPending ? 'Adding…' : 'Add centre'}
          </Button>
        </div>
      }
    >
      <form id="add-tc-form" className="stack-form" onSubmit={submit} noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}

        <TextField
          label="Name"
          value={name}
          autoFocus
          required
          placeholder="Idudi"
          error={error?.fields?.name?.[0]}
          onChange={(event) => setName(event.target.value)}
        />

        <TextField
          label="Address"
          value={address}
          placeholder="Optional"
          onChange={(event) => setAddress(event.target.value)}
        />
      </form>
    </Modal>
  )
}
