/**
 * Import a stock count — a stock take done from a spreadsheet.
 *
 * ---------------------------------------------------------------------------
 * Why this imports a *count*, not a quantity
 * ---------------------------------------------------------------------------
 * Stock here is an append-only ledger: nothing is ever set, only moved, and
 * every movement records who, when and a reason code. A CSV that wrote
 * quantities straight in would be the one change in the system with no
 * reason behind it and no way to unpick.
 *
 * So each row says "this is what I counted", and the server does the rest —
 * `POST /inventory/adjustments/correct-count/` reads what the system thinks
 * is on hand, works out the difference, and posts an adjustment for it. That
 * is the same path the single-SKU count screen uses; this is it in bulk.
 *
 * Three things fall out of that, all of them worth having:
 *
 *   **It is safe to run twice.** A count that matches writes nothing — there
 *   is no such thing as a zero-quantity adjustment. Re-importing the same
 *   file is a no-op. An "add this much" import would silently double the
 *   stock, and nobody would find out until the next count.
 *
 *   **It counts what is physically there.** The server compares against
 *   available *plus* picked, because picked stock is still on the shelf. A
 *   naive comparison against available alone invents inventory every time it
 *   meets an order that has been picked but not shipped.
 *
 *   **A shortfall below what is already reserved is refused**, not quietly
 *   taken out of stock somebody has claimed for an order. That is a pick
 *   that can no longer be filled — a different problem, and not one to
 *   paper over here.
 *
 * ---------------------------------------------------------------------------
 * Nothing is written until the preview is confirmed
 * ---------------------------------------------------------------------------
 * The file is parsed and matched against the catalogue first, and every row
 * is shown with what the system currently holds and what would change.
 * Unknown SKUs are listed and refused rather than skipped silently.
 *
 * Rows commit one at a time, because the endpoint takes one SKU. A row that
 * fails therefore does not take the rest down — but it does mean a run can
 * half-succeed, so the result says exactly which rows landed.
 */

import { useMemo, useState, type ChangeEvent } from 'react'
import { Alert, Button, Modal } from '@/components'
import * as adjustmentsApi from '@/api/adjustments'
import { toApiError } from '@/api/errors'
import { todayISO } from '@/domain/dates'
import { formatQuantity, formatSignedQuantity } from '@/domain/money'
import { useInventoryRows } from '../hooks/useInventoryRows'

interface ParsedRow {
  line: number
  sku: string
  warehouse: string
  counted: number
}

interface MatchedRow extends ParsedRow {
  skuId: number | null
  warehouseId: number | null
  /** Available + picked, as the server will compare against. */
  system: number | null
  problem: string | null
}

/**
 * A deliberately small CSV reader: split on newlines, then on commas.
 *
 * No quoting, no embedded commas — a stock count is three short columns and
 * a parser that handles every edge of RFC 4180 would be more code than the
 * feature. A file it cannot read fails loudly at the matching step rather
 * than being half-understood.
 */
function parseCsv(text: string): { rows: ParsedRow[]; error: string | null } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return { rows: [], error: 'That file is empty.' }

  const header = lines[0].split(',').map((cell) => cell.trim().toLowerCase())
  const skuAt = header.findIndex((cell) => cell.includes('sku'))
  const whAt = header.findIndex((cell) => cell.includes('warehouse'))
  const countAt = header.findIndex(
    (cell) => cell.includes('count') || cell.includes('quantity') || cell.includes('qty'),
  )

  if (skuAt === -1 || countAt === -1) {
    return {
      rows: [],
      error:
        'The first row must name the columns, and must include one called SKU and one called Counted.',
    }
  }

  const rows = lines.slice(1).map((line, index) => {
    const cells = line.split(',').map((cell) => cell.trim())
    return {
      line: index + 2,
      sku: cells[skuAt] ?? '',
      warehouse: whAt === -1 ? '' : (cells[whAt] ?? ''),
      counted: Number(cells[countAt]),
    }
  })

  return { rows, error: null }
}

interface ImportCountModalProps {
  open: boolean
  onClose: () => void
}

export function ImportCountModal({ open, onClose }: ImportCountModalProps) {
  // Every SKU at every warehouse, which is what a row has to be matched
  // against — and what gives the preview its "system" column.
  const { rows: inventory } = useInventoryRows({
    level: null,
    sizeId: null,
    isActive: null,
    lowStockOnly: false,
    query: '',
  })

  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ posted: number; matched: number; failed: string[] } | null>(
    null,
  )

  const matched: MatchedRow[] = useMemo(() => {
    if (!parsed) return []

    return parsed.map((row) => {
      if (!Number.isFinite(row.counted) || row.counted < 0) {
        return { ...row, skuId: null, warehouseId: null, system: null, problem: 'Not a count' }
      }

      const candidates = inventory.filter(
        (entry) => entry.skuNumber.toLowerCase() === row.sku.toLowerCase(),
      )
      if (candidates.length === 0) {
        return { ...row, skuId: null, warehouseId: null, system: null, problem: 'Unknown SKU' }
      }

      const hit = row.warehouse
        ? candidates.find(
            (entry) => entry.warehouseName.toLowerCase() === row.warehouse.toLowerCase(),
          )
        : candidates.length === 1
          ? candidates[0]
          : undefined

      if (!hit) {
        return {
          ...row,
          skuId: null,
          warehouseId: null,
          system: null,
          problem: row.warehouse ? 'Unknown warehouse' : 'Name the warehouse',
        }
      }

      return {
        ...row,
        skuId: hit.skuId,
        warehouseId: hit.warehouseId,
        // What the server compares against: on the shelf, reserved or not.
        system: hit.available + hit.pick,
        problem: null,
      }
    })
  }, [parsed, inventory])

  const usable = matched.filter((row) => row.problem === null)
  const problems = matched.filter((row) => row.problem !== null)
  const changing = usable.filter((row) => row.counted !== (row.system ?? 0))

  function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setResult(null)
    file.text().then((text) => {
      const outcome = parseCsv(text)
      setFileError(outcome.error)
      setParsed(outcome.error ? null : outcome.rows)
    })
  }

  function close() {
    setParsed(null)
    setFileError(null)
    setNotes('')
    setResult(null)
    setRunning(false)
    onClose()
  }

  async function run() {
    setRunning(true)
    const failed: string[] = []
    let posted = 0

    // Sequential on purpose. Each row is its own adjustment against the same
    // ledger, and firing thirty at once means thirty reads of a stock level
    // that the other twenty-nine are in the middle of changing.
    for (const row of changing) {
      try {
        await adjustmentsApi.correctCount({
          warehouse: row.warehouseId as number,
          sku: row.skuId as number,
          counted_quantity: row.counted,
          adjustment_date: todayISO(),
          notes: notes.trim() || 'Imported stock count',
        })
        posted += 1
      } catch (cause) {
        failed.push(`${row.sku}: ${toApiError(cause).message}`)
      }
    }

    setRunning(false)
    setResult({ posted, matched: usable.length, failed })
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import stock count"
      subtitle="A counted quantity per SKU. The system works out the difference and posts it."
      size="lg"
      footer={
        <div className="modal__foot-actions">
          <Button variant="secondary" onClick={close} disabled={running}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              disabled={changing.length === 0 || problems.length > 0 || running}
              onClick={() => void run()}
            >
              {running
                ? `Posting ${changing.length}…`
                : `Post ${changing.length} correction${changing.length === 1 ? '' : 's'}`}
            </Button>
          )}
        </div>
      }
    >
      <div className="stack-form">
        {result ? (
          <Alert tone={result.failed.length > 0 ? 'warning' : 'success'}>
            <strong>
              {result.posted} correction{result.posted === 1 ? '' : 's'} posted.
            </strong>{' '}
            {result.matched - result.posted - result.failed.length > 0 &&
              `${result.matched - result.posted - result.failed.length} rows already matched and were left alone. `}
            {result.failed.length > 0 && (
              <>
                These did not post: {result.failed.join('; ')}
              </>
            )}
          </Alert>
        ) : (
          <>
            <Alert tone="info">
              Each row is <strong>what you counted</strong>, not what to add. The
              system compares it with what it holds and posts only the
              difference — so running the same file twice changes nothing the
              second time.
            </Alert>

            <div className="field field--stacked">
              <label htmlFor="import-file">Count file</label>
              <input
                id="import-file"
                className="input"
                type="file"
                accept=".csv,text/csv"
                onChange={readFile}
              />
              <p className="field__hint">
                A CSV whose first row names the columns. It needs one called
                SKU and one called Counted; add Warehouse when a SKU is held
                at more than one.
              </p>
            </div>

            {fileError && <Alert tone="error">{fileError}</Alert>}

            {problems.length > 0 && (
              <Alert tone="error">
                <strong>
                  {problems.length} row{problems.length === 1 ? '' : 's'} could not be
                  matched.
                </strong>{' '}
                Nothing is posted until every row is understood — fix the file
                and load it again.
              </Alert>
            )}

            {matched.length > 0 && (
              <div className="table-scroll">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>SKU</th>
                      <th>Warehouse</th>
                      <th className="ledger__num">On system</th>
                      <th className="ledger__num">Counted</th>
                      <th className="ledger__num">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matched.map((row) => {
                      const delta =
                        row.problem === null ? row.counted - (row.system as number) : null
                      return (
                        <tr key={row.line}>
                          <td>{row.line}</td>
                          <td className="ledger__code">{row.sku || '—'}</td>
                          <td className="ledger__wrap">{row.warehouse || '—'}</td>
                          <td className="ledger__num">
                            {row.system === null ? '—' : formatQuantity(row.system)}
                          </td>
                          <td className="ledger__num">
                            {Number.isFinite(row.counted) ? formatQuantity(row.counted) : '—'}
                          </td>
                          <td className="ledger__num">
                            {row.problem ? (
                              <span className="users__site--missing">{row.problem}</span>
                            ) : delta === 0 ? (
                              <span className="detail-list__muted">No change</span>
                            ) : (
                              <strong>{formatSignedQuantity(delta as number)}</strong>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {matched.length > 0 && problems.length === 0 && (
              <div className="field field--stacked">
                <label htmlFor="import-notes">Note</label>
                <input
                  id="import-notes"
                  className="input"
                  value={notes}
                  placeholder="Term 3 stock take"
                  onChange={(event) => setNotes(event.target.value)}
                />
                <p className="field__hint">
                  Goes on every adjustment this posts, so the ledger says what
                  the count was for.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
