/**
 * Change a garment's price, and see what it has been.
 *
 * ---------------------------------------------------------------------------
 * This is not an edit
 * ---------------------------------------------------------------------------
 * A price is not a number on a product; it is a number that *applied over a
 * period*. So changing one closes the current period on a date and opens a
 * new one from it — `POST /garments/{id}/reprice/`, both writes in one
 * transaction. Nothing is ever rewritten.
 *
 * That is what lets an invoice raised in March reprint at March's price
 * however many times the garment is repriced afterwards, which is the whole
 * reason the model is dated. A form that overwrote the figure would quietly
 * destroy every past invoice's arithmetic.
 *
 * The history is shown for the same reason: "what is it now" is the smaller
 * half of the question, and somebody about to change a price wants to see
 * what it has already been.
 */

import { useState, type FormEvent } from 'react'
import { Alert, Button, Modal, TextField } from '@/components'
import { toApiError } from '@/api/errors'
import { formatDay, todayISO } from '@/domain/dates'
import { formatUGX } from '@/domain/money'
import type { Garment } from '@/api/types'
import { useGarmentPrices, useReprice } from '../hooks/useCreateGarment'

interface RepriceModalProps {
  open: boolean
  onClose: () => void
  garment: Garment | null
}

export function RepriceModal({ open, onClose, garment }: RepriceModalProps) {
  const save = useReprice(garment?.id ?? 0)
  const history = useGarmentPrices(open && garment ? garment.id : null)
  const error = save.error ? toApiError(save.error) : null

  const [price, setPrice] = useState('')
  const [from, setFrom] = useState(todayISO())

  function close() {
    setPrice('')
    setFrom(todayISO())
    save.reset()
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!price.trim()) return
    save.mutate({ unit_price: price.trim(), active_from: from }, { onSuccess: close })
  }

  if (!garment) return null

  const rows = history.data ?? []

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Price ${garment.name}`}
      subtitle="Sets a new price from a date. The current one is closed on it, never rewritten."
      size="md"
      footer={
        <div className="modal__foot-actions">
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="reprice-form"
            disabled={!price.trim() || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Set price'}
          </Button>
        </div>
      }
    >
      <form id="reprice-form" className="stack-form" onSubmit={submit} noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}

        <p className="modal-form__fact">
          <span>Price today</span>
          <strong className="t-numeric">
            {garment.current_price ? formatUGX(garment.current_price) : 'Not priced'}
          </strong>
        </p>

        <TextField
          label="New price (UGX)"
          type="number"
          min={0}
          step="0.01"
          required
          autoFocus
          value={price}
          error={error?.fields?.unit_price?.[0]}
          onChange={(event) => setPrice(event.target.value)}
        />

        <div className="field field--stacked">
          <TextField
            label="Applies from"
            type="date"
            required
            value={from}
            error={error?.fields?.active_from?.[0]}
            onChange={(event) => setFrom(event.target.value)}
          />
          {/*
            Today by default, not "now and retrospectively". A price set from
            next term is a normal thing to do; silently backdating one would
            change what past orders should have cost.
          */}
          <p className="field__hint">
            The current price runs until this date. Orders already placed keep
            the price that applied on their own date.
          </p>
        </div>

        {rows.length > 0 && (
          <div className="field field--stacked">
            <span className="field__label">What it has been</span>
            <div className="table-scroll">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>Until</th>
                    <th className="ledger__num">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.active_date}-${row.unit_price}`}>
                      <td className="ledger__nowrap">{formatDay(row.active_date)}</td>
                      {/* An open period is the one in force — it has no end
                          yet, which is not the same as ending today. */}
                      <td className="ledger__nowrap">
                        {row.expiration_date ? formatDay(row.expiration_date) : 'Now'}
                      </td>
                      <td className="ledger__num t-numeric">{formatUGX(row.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
