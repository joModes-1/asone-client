/**
 * Load a catalogue spreadsheet — garments, their sizes, their SKUs and a
 * price for each.
 *
 * ---------------------------------------------------------------------------
 * Why this is separate from Import stock count
 * ---------------------------------------------------------------------------
 * They sound alike and are opposites. This one *creates* products and can be
 * undone by editing them. The stock count posts adjustments to an
 * append-only ledger, which can only be corrected by posting more. One
 * "Import" button doing both would make the safer operation feel as
 * consequential as the riskier one, and hide which had happened.
 *
 * It also lives in a different place: this is on the Garments tab, because
 * garments are what it makes.
 *
 * ---------------------------------------------------------------------------
 * Check first, then import
 * ---------------------------------------------------------------------------
 * The dialogue runs a dry run before it will import anything. The server
 * reads the whole file, reports what it *would* create, and writes nothing.
 * Only then does the import button appear. A catalogue is a few hundred rows
 * typed by hand; being told what is about to happen is worth one extra click.
 *
 * Rejections list **every** bad row with its line number, not the first.
 * Fixing a spreadsheet one error per run is miserable when there are thirty,
 * and a screen can show them all at once where a terminal cannot.
 */

import { useState, type ChangeEvent } from 'react'
import { Alert, Button, Modal, snackbar } from '@/components'
import * as catalogApi from '@/api/catalog'
import type { CatalogueImportResult, CatalogueImportRowError } from '@/api/catalog'
import { toApiError } from '@/api/errors'

import { useQueryClient } from '@tanstack/react-query'
import { invalidatePricedViews } from '../hooks/useCreateGarment'

interface ImportGarmentsModalProps {
  open: boolean
  onClose: () => void
}

/** The server's 400 body when rows could not be read. */
function rowErrorsFrom(cause: unknown): CatalogueImportRowError[] {
  const body = (cause as { response?: { data?: { rows?: unknown } } })?.response?.data?.rows
  return Array.isArray(body) ? (body as CatalogueImportRowError[]) : []
}

export function ImportGarmentsModal({ open, onClose }: ImportGarmentsModalProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [checked, setChecked] = useState<CatalogueImportResult | null>(null)
  const [rowErrors, setRowErrors] = useState<CatalogueImportRowError[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setFile(null)
    setChecked(null)
    setRowErrors([])
    setMessage(null)
    setBusy(false)
  }

  function close() {
    reset()
    onClose()
  }

  function pick(event: ChangeEvent<HTMLInputElement>) {
    // A new file invalidates the previous answer — the counts on screen
    // describe the file that produced them, not whatever is chosen now.
    setChecked(null)
    setRowErrors([])
    setMessage(null)
    setFile(event.target.files?.[0] ?? null)
  }

  async function run(dryRun: boolean) {
    if (!file) return
    setBusy(true)
    setRowErrors([])
    setMessage(null)

    try {
      const result = await catalogApi.importCatalogue(file, { dryRun })
      if (dryRun) {
        setChecked(result)
      } else {
        // Everything showing a garment, a SKU or a price is now out of date.
        invalidatePricedViews(queryClient)
        snackbar.success('Catalogue imported', result.detail)
        close()
      }
    } catch (cause) {
      const rows = rowErrorsFrom(cause)
      setRowErrors(rows)
      setMessage(rows.length ? null : toApiError(cause).message)
      setChecked(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import garments"
      subtitle="A spreadsheet of garments, their sizes and a price for each."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          {checked ? (
            <Button onClick={() => run(false)} disabled={busy}>
              {busy ? 'Importing…' : 'Import for real'}
            </Button>
          ) : (
            <Button onClick={() => run(true)} disabled={!file || busy}>
              {busy ? 'Checking…' : 'Check file'}
            </Button>
          )}
        </>
      }
    >
      <div className="stack-form">
        <div>
          <label htmlFor="catalogue-file" className="textfield__label">
            Spreadsheet
          </label>
          <input
            id="catalogue-file"
            type="file"
            className="input"
            accept=".csv,.xlsx,.xlsm"
            onChange={pick}
          />
          <p className="field__hint">
            Needs columns <code>name</code>, <code>school_level</code>, <code>sizes</code> and{' '}
            <code>unit_price</code>. Add <code>code</code>, <code>colour_code</code> and{' '}
            <code>fit_group</code> to get the full UNI-NUR-CHS-XS-CHK SKU numbers.
            Sizes are separated by semicolons: <code>XS;S;M;L;XL;XXL</code>.
          </p>
        </div>

        {message && <Alert tone="error">{message}</Alert>}

        {rowErrors.length > 0 && (
          <Alert tone="error">
            <strong>Nothing was imported.</strong> {rowErrors.length}{' '}
            {rowErrors.length === 1 ? 'row' : 'rows'} could not be read. Fix the file and
            check it again.
            <ul className="import-errors">
              {rowErrors.map((row) => (
                <li key={`${row.line}-${row.message}`}>
                  <strong>Line {row.line}:</strong> {row.message}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {checked && (
          <Alert tone="success">
            <strong>Checked, nothing written yet.</strong> This file would create{' '}
            {checked.garments} garments, {checked.sizes} sizes, {checked.skus} SKUs and{' '}
            {checked.prices} prices.
            {checked.unchanged > 0 && (
              <>
                {' '}
                {checked.unchanged} {checked.unchanged === 1 ? 'garment is' : 'garments are'}{' '}
                already in the catalogue and would be left alone.
              </>
            )}
          </Alert>
        )}
      </div>
    </Modal>
  )
}
