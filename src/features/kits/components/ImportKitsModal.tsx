/**
 * Load a kit bill of materials — the kits, and the SKUs in each.
 *
 * ---------------------------------------------------------------------------
 * Why a kit import exists at all
 * ---------------------------------------------------------------------------
 * AsOne's 2027 catalogue has 120 kits — five class bands, two genders, day
 * or boarder, six sizes — carrying 828 component lines between them. That is
 * a hundred and twenty passes through the create form. The sheet they
 * already keep is the way in.
 *
 * ---------------------------------------------------------------------------
 * Check first, then import
 * ---------------------------------------------------------------------------
 * Same two steps as the garment import, and here the second step matters
 * more: for a kit named in the file, the file's components **replace** what
 * the kit holds. A dry run is how somebody finds out that a sheet they
 * thought was an addition removes forty lines.
 *
 * Rejections list every bad row with its line number. The commonest by far
 * is an unknown component SKU, which means the garment catalogue has not
 * been imported yet — so the dialogue says that before anybody uploads
 * anything.
 */

import { useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Modal, snackbar } from '@/components'
import * as kitsApi from '@/api/kits'
import type { KitImportResult } from '@/api/kits'
import type { CatalogueImportRowError } from '@/api/catalog'
import { toApiError } from '@/api/errors'

interface ImportKitsModalProps {
  open: boolean
  onClose: () => void
}

/** The server's 400 body when rows could not be read. */
function rowErrorsFrom(cause: unknown): CatalogueImportRowError[] {
  const body = (cause as { response?: { data?: { rows?: unknown } } })?.response?.data?.rows
  return Array.isArray(body) ? (body as CatalogueImportRowError[]) : []
}

/**
 * The server's own count, not one worked out from the list.
 *
 * A problem can cover many rows — one SKU missing from the catalogue is one
 * message and 120 bad rows — so counting the messages on screen would
 * report "1 row could not be read" for a file where 120 were.
 */
function summaryFrom(cause: unknown): string | null {
  const detail = (cause as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail
  return typeof detail === 'string' ? detail : null
}

export function ImportKitsModal({ open, onClose }: ImportKitsModalProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [checked, setChecked] = useState<KitImportResult | null>(null)
  const [rowErrors, setRowErrors] = useState<CatalogueImportRowError[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setFile(null)
    setChecked(null)
    setRowErrors([])
    setSummary(null)
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
    setSummary(null)
    setMessage(null)
    setFile(event.target.files?.[0] ?? null)
  }

  async function run(dryRun: boolean) {
    if (!file) return
    setBusy(true)
    setRowErrors([])
    setSummary(null)
    setMessage(null)

    try {
      const result = await kitsApi.importKits(file, { dryRun })
      if (dryRun) {
        setChecked(result)
      } else {
        void queryClient.invalidateQueries({ queryKey: ['kits'] })
        void queryClient.invalidateQueries({ queryKey: ['kit-items'] })
        // A school's price list prints kit bundles, so it moves with them.
        void queryClient.invalidateQueries({ queryKey: ['price-lists'] })
        snackbar.success('Kits imported', result.detail)
        close()
      }
    } catch (cause) {
      const rows = rowErrorsFrom(cause)
      setRowErrors(rows)
      setSummary(summaryFrom(cause))
      setMessage(rows.length ? null : toApiError(cause).message)
      setChecked(null)
    } finally {
      setBusy(false)
    }
  }

  /* Capped. A sheet read before its catalogue reports all 828 of its lines,
     and a dialogue scrolling past the Cancel button helps nobody. */
  const shown = rowErrors.slice(0, 15)

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import kits"
      /*
        Wide, unlike most dialogs here. The others are a stack of
        fields, where a narrow column keeps a label beside its input.
        This one's content is a list of rejected rows — "Line 6: there
        is no SKU called 'UNI-ALL-SOC-OS-GRY'…" — and at 440px each of
        those wraps to six lines, so a dozen of them scroll off a
        screen that had room for all of them.
      */
      size="lg"
      subtitle="A spreadsheet of kits and the garments in each."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          {checked ? (
            <Button onClick={() => run(false)} disabled={busy}>
              {busy ? 'Importing…' : `Import ${checked.kits} kits`}
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
          <label htmlFor="kit-bom-file" className="textfield__label">
            Spreadsheet
          </label>
          <input
            id="kit-bom-file"
            type="file"
            className="input"
            accept=".csv,.xlsx,.xlsm"
            onChange={pick}
          />
          <p className="field__hint">
            One row per component. Needs columns <code>fit_group</code>,{' '}
            <code>gender</code>, <code>residence</code>, <code>size</code> and{' '}
            <code>component_sku</code>. <code>kit_name</code> and <code>qty</code> are
            optional, and <code>qty</code> defaults to 1. The kit number is
            composed from the first four — <code>KIT-NUR-B-DAY-XS</code> — so it
            is not asked for, and a number in the file is checked against it.
          </p>
        </div>

        {/*
          Said before anything is uploaded, not after. An unknown component
          SKU is by far the commonest rejection, and it almost always means
          the two sheets were loaded in the wrong order.
        */}
        <Alert tone="info">
          <strong>Import the garments first.</strong> Components are matched to
          SKUs that already exist, by number. Nothing in the catalogue is
          created here, so a kit sheet loaded before its garments reports
          every line as an unknown SKU.
        </Alert>

        {message && <Alert tone="error">{message}</Alert>}

        {rowErrors.length > 0 && (
          <Alert tone="error">
            {/*
              The server's sentence, as it wrote it. It counts problems and
              rows separately — "1 problem, across 120 rows" — and a count
              taken from the list on screen would say "1 row", because one
              missing SKU used by 120 kits is one message.
            */}
            <strong>{summary ?? 'Nothing was imported.'}</strong> Fix the file
            and check it again.
            <ul className="import-errors">
              {shown.map((row) => (
                <li key={`${row.line}-${row.message}`}>
                  <strong>Line {row.line}:</strong> {row.message}
                </li>
              ))}
            </ul>
            {rowErrors.length > shown.length && (
              <p>…and {rowErrors.length - shown.length} more.</p>
            )}
          </Alert>
        )}

        {/*
          Warning rather than success, for the reason spelled out in
          `ImportGarmentsModal`: green plus large numbers reads as *done*,
          and somebody closed that dialogue believing a file had been
          written when it had not.
        */}
        {checked && (
          <Alert tone="warning">
            <strong>Nothing has been imported yet.</strong> This is a check. It
            would create {checked.kits} kits and {checked.components} components.
            {checked.unchanged > 0 && (
              <>
                {' '}
                {checked.unchanged} {checked.unchanged === 1 ? 'kit is' : 'kits are'}{' '}
                already in the system.
              </>
            )}
            {checked.components_changed > 0 && (
              <>
                {' '}
                {checked.components_changed}{' '}
                {checked.components_changed === 1 ? 'quantity' : 'quantities'} would
                change.
              </>
            )}
            {/*
              Its own sentence, and strong. This is the destructive half of
              the import, and the dry run is the only place anybody is told
              before it runs.
            */}
            {checked.components_removed > 0 && (
              <>
                {' '}
                <strong>
                  {checked.components_removed}{' '}
                  {checked.components_removed === 1 ? 'component' : 'components'}{' '}
                  would be removed from kits this file names, because the file
                  no longer lists{' '}
                  {checked.components_removed === 1 ? 'it' : 'them'}.
                </strong>
              </>
            )}{' '}
            <strong>Press “Import {checked.kits} kits” below to write it.</strong>
          </Alert>
        )}
      </div>
    </Modal>
  )
}
