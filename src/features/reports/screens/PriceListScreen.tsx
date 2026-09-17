/**
 * Price Lists — F15, F51.
 *
 * The document a school orders from: every active garment on one school
 * level, with the price that applied on a chosen date.
 *
 * ---------------------------------------------------------------------------
 * Why the date is a control and not just "today"
 * ---------------------------------------------------------------------------
 * A price is not a number on a garment, it is a number that applied over a
 * period — `GarmentPrice` carries `active_date` and `expiration_date`, and
 * repricing closes one period and opens another rather than overwriting.
 *
 * So "what does this cost" has no answer without a date, and the question
 * somebody actually brings to this screen is usually about a past one:
 * reprinting March's invoice, or checking what a school was quoted before a
 * price moved. A screen locked to today could not answer either.
 *
 * ---------------------------------------------------------------------------
 * The gap report is on the same screen on purpose
 * ---------------------------------------------------------------------------
 * A garment with no price on the date is **left off the list entirely** — the
 * server omits it rather than showing UGX 0, because a line with no price is
 * worse than no line on a document a school buys from.
 *
 * That is right for the document and dangerous for the person publishing it:
 * the omission is invisible, so a garment can quietly stop being orderable
 * and nobody finds out until a school asks where it went. `/price-lists/gaps/`
 * exists exactly to catch that, and a gap report nobody opens is a gap report
 * nobody reads — so it is not a second screen, it is the banner above this
 * one.
 *
 * ---------------------------------------------------------------------------
 * Not the school's own copy
 * ---------------------------------------------------------------------------
 * F29 — a school works from its own list — is served where a school actually
 * needs it, on the order form, which shows today's price beside every garment
 * it may order. This screen is the Finance and lead view: name the list you
 * want, on the date you want, and see what is missing from it.
 */

import { useState } from 'react'
import { ArrowLeft, Tag, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Alert, Badge, EmptyState, SkeletonRows, snackbar } from '@/components'
import { downloadFile, toCsv } from '@/domain/csv'
import { formatUGX } from '@/domain/money'
import { schoolLevelLabel } from '@/domain/sizes'
import { AppShell } from '@/features/shell/components/AppShell'
import { ExportControls } from '../components/ExportControls'
import { today } from '../today'
import { usePriceGaps, usePriceList, type PriceListLevel } from '../hooks/usePriceList'

const LEVELS: readonly { level: PriceListLevel; label: string }[] = [
  { level: 'PS', label: 'Primary School' },
  { level: 'HS', label: 'High School' },
]

function levelLabel(level: PriceListLevel): string {
  return LEVELS.find((entry) => entry.level === level)?.label ?? level
}

export function PriceListScreen() {
  const [level, setLevel] = useState<PriceListLevel>('PS')
  const [onDate, setOnDate] = useState(today())

  const list = usePriceList(level, onDate)
  const gaps = usePriceGaps(level, onDate)

  const rows = list.data ?? []
  const missing = gaps.data ?? []

  function exportCsv() {
    const filename = `asone-price-list-${level.toLowerCase()}-${onDate}.csv`
    downloadFile(
      filename,
      toCsv(
        ['Garment', 'Colour', 'Unit price (UGX)'],
        // The raw decimal string, not the formatted figure: a spreadsheet
        // wants a number it can total, not "UGX 30,000".
        rows.map((row) => [row.garment, row.colour, row.unit_price]),
      ),
    )
    snackbar.success(
      `Exported ${rows.length} ${rows.length === 1 ? 'garment' : 'garments'}`,
      filename,
    )
  }

  return (
    <AppShell title="Price Lists">
      <Link className="page-back" to="/reports">
        <ArrowLeft size={14} aria-hidden />
        All reports
      </Link>

      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Price Lists</h1>
          <p className="page-head__subtitle">
            What a {levelLabel(level)} pays per garment
            {onDate === today() ? ' today' : ` on ${onDate}`}. Garments marked for
            both levels appear on each list.
          </p>
        </div>

        <ExportControls onExportCsv={exportCsv} disabled={list.isLoading || rows.length === 0} />
      </header>

      <div className="filter-bar">
        <label className="filter-bar__field">
          <span>List:</span>
          <select
            aria-label="School level"
            value={level}
            onChange={(event) => setLevel(event.target.value as PriceListLevel)}
          >
            {LEVELS.map((entry) => (
              <option key={entry.level} value={entry.level}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-bar__field">
          <span>Priced on:</span>
          <input
            type="date"
            aria-label="Price list date"
            value={onDate}
            onChange={(event) => setOnDate(event.target.value || today())}
          />
        </label>
      </div>

      {list.isError && (
        <Alert tone="error">
          The price list could not be loaded. Nothing below is a quote — try
          again in a moment.
        </Alert>
      )}

      {/*
        Not a silent failure. If the gap report is the only thing that failed
        the list beside it is still correct, but the reader has lost the one
        check that says whether it is complete — and the whole point of
        putting the two together is that the list cannot be trusted alone.
      */}
      {gaps.isError && (
        <Alert tone="warning">
          The gap check could not be run, so this list has not been confirmed
          complete. A garment with no price on this date is left off it
          entirely, and there is currently no way to tell whether that has
          happened.
        </Alert>
      )}

      {!gaps.isError && missing.length > 0 && (
        <Alert tone="warning">
          <strong>
            {missing.length} active {missing.length === 1 ? 'garment is' : 'garments are'} missing
            from this list
          </strong>{' '}
          — {missing.map((garment) => garment.name).join(', ')}. Each has no price on{' '}
          {onDate === today() ? 'today' : onDate}, so it has been left off rather than shown at
          zero. A school cannot order what is not on the list: set a price before publishing this.
        </Alert>
      )}

      <div className="table-card">
        {list.isLoading ? (
          <SkeletonRows rows={8} />
        ) : rows.length === 0 && !list.isError ? (
          <EmptyState
            title="Nothing is priced on this list"
            body={
              missing.length > 0
                ? 'Every active garment for this level is missing a price on this date. Set one from the Garments tab on Inventory.'
                : 'No active garment is on this list. Garments carry the level they belong to, and one marked for the other level will not appear here.'
            }
            icon={Tag}
          />
        ) : (
          <div className="table-scroll">
            <table className="ledger ledger--price-list">
              <thead>
                <tr>
                  <th>Garment</th>
                  <th>Colour</th>
                  <th className="ledger__num">Unit price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.garment_id}>
                    <td className="ledger__wrap">{row.garment}</td>
                    <td className="ledger__nowrap">{row.colour || '—'}</td>
                    <td className="ledger__num t-numeric">{formatUGX(row.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/*
          No pagination. AsOne has tens of garments, and unlike every other
          table in the app this one is a *document* — a price list that
          arrives in pages is not a price list, and the CSV beside it would
          then disagree with what is on screen.
        */}
        {!list.isLoading && rows.length > 0 && (
          <div className="table-card__footer">
            <p className="table-card__note">
              {rows.length} priced {rows.length === 1 ? 'garment' : 'garments'} on the{' '}
              {levelLabel(level)} list.{' '}
              {missing.length === 0 && !gaps.isError && (
                <Badge tone="success">Complete — nothing unpriced</Badge>
              )}
            </p>
          </div>
        )}
      </div>

      {/* The gap report in full, once it is more than a sentence. */}
      {missing.length > 0 && (
        <div className="table-card">
          <table className="ledger">
            <thead>
              <tr>
                <th>
                  <TriangleAlert size={14} aria-hidden /> Unpriced garment
                </th>
                <th>Code</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((garment) => (
                <tr key={garment.id}>
                  <td className="ledger__wrap">{garment.name}</td>
                  <td className="ledger__code">{garment.code}</td>
                  <td className="ledger__nowrap">{schoolLevelLabel(garment.school_level)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
