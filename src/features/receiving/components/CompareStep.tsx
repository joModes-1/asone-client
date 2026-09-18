/**
 * Step 3 — what the paper said against what was counted off the van.
 *
 * The one screen where the warehouse does the job AsOne's flow (p.5) asks
 * of it: check the delivery, resolve the differences, and only then commit.
 *
 * Two rules this screen exists to hold:
 *
 *   **A difference is shown, never resolved.** The count and the expected
 *   figure stay as two numbers. Nothing here averages them or quietly takes
 *   the larger — the gap is the finding.
 *
 *   **A zero net is not the same as a clean delivery.** Ten short on one
 *   size and ten over on another nets to nothing and is two errors. The
 *   summary says so rather than showing a reassuring 0.
 */

import { Button, Panel } from '@/components'
import { formatQuantity } from '@/domain/money'
import {
  difference,
  lineStatus,
  netDiscrepancyLabel,
  reconcile,
  type LineStatus,
} from '@/domain/receiving'
import type { OutstandingRow } from '@/api/types'

/** Received counts, keyed by SKU id. Held by the screen above. */
export type CountsBySku = Record<number, number>

/** Per-line discrepancy notes, keyed by SKU id. Also held above. */
export type ReasonsBySku = Record<number, string>

interface CompareStepProps {
  orderNumber: string
  tailoringCenterName: string
  warehouseName: string
  expected: OutstandingRow[]
  counts: CountsBySku
  onCountChange: (skuId: number, value: number) => void
  /** Why each differing line differs, keyed by SKU id. */
  reasons: ReasonsBySku
  onReasonChange: (skuId: number, value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  onFinalize: () => void
  finalizing: boolean
}

const STATUS_CLASS: Record<LineStatus, string> = {
  MATCHED: 'matched',
  SHORTAGE: 'shortage',
  SURPLUS: 'surplus',
}

export function CompareStep({
  orderNumber,
  tailoringCenterName,
  warehouseName,
  expected,
  counts,
  onCountChange,
  reasons,
  onReasonChange,
  notes,
  onNotesChange,
  onFinalize,
  finalizing,
}: CompareStepProps) {
  const lines = expected.map((row) => ({
    expected: row.outstanding,
    received: counts[row.sku] ?? 0,
  }))
  const summary = reconcile(lines)

  /*
   * The server refuses a line of zero — `quantity_received` has a minimum of
   * one — so a delivery where nothing at all was counted has nothing to
   * record. Anything else is postable, discrepancies included: a short
   * delivery is still a delivery.
   */
  const anythingCounted = summary.totalReceived > 0

  return (
    <div className="receiving__columns receiving__columns--wide">
      <Panel
        title="Receipt Validation Matrix"
        meta={
          summary.discrepancyCount > 0 ? (
            <span className="pill pill--amber">
              {summary.discrepancyCount} DISCREPANC
              {summary.discrepancyCount === 1 ? 'Y' : 'IES'} DETECTED
            </span>
          ) : (
            <span className="pill pill--mint">ALL MATCHED</span>
          )
        }
      >
        <p className="panel__sub">
          {orderNumber} ({tailoringCenterName})
        </p>

        <div className="table-scroll">
          <table className="ledger validation">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Description</th>
                <th className="ledger__num">Expected</th>
                <th className="ledger__num">Received (In)</th>
                <th className="ledger__num">Diff</th>
                <th className="ledger__num">Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {expected.map((row) => {
                const received = counts[row.sku] ?? 0
                const diff = difference(row.outstanding, received)
                const status = lineStatus(row.outstanding, received)

                return (
                  <tr
                    key={row.sku}
                    className={
                      status === 'MATCHED' ? undefined : `validation__row--${STATUS_CLASS[status]}`
                    }
                  >
                    <td className="ledger__code">{row.sku_number}</td>
                    <td className="ledger__wrap">{row.sku_description}</td>
                    <td className="ledger__num">{formatQuantity(row.outstanding)}</td>
                    <td className="ledger__num">
                      <input
                        className="input input--count"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`Received count for ${row.sku_number}`}
                        value={received}
                        onChange={(event) =>
                          /*
                            Rounded, not just clamped. These controls are not
                            inside a <form> and submit is a plain click, so
                            `min` and `step` are never enforced by the
                            browser — a typed "5.5" would post a fractional
                            count and 400 after the whole van was keyed.
                          */
                          onCountChange(
                            row.sku,
                            Math.max(0, Math.round(Number(event.target.value) || 0)),
                          )
                        }
                      />
                    </td>
                    <td className={`ledger__num validation__diff--${STATUS_CLASS[status]}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                    <td className="ledger__num">
                      <span className={`chip chip--${STATUS_CLASS[status]}`}>{status}</span>
                    </td>
                    <td>
                      {status === 'MATCHED' ? (
                        /* Not a disabled input. A greyed-out box on every
                           matched line reads as something you failed to
                           fill in; a dash reads as nothing to say. */
                        <span className="validation__no-reason">—</span>
                      ) : (
                        <input
                          className="input validation__reason"
                          type="text"
                          /* The server column is 200 characters. Enforced
                             here so a long note is stopped as it is typed
                             rather than 400-ing after the whole van is
                             keyed. */
                          maxLength={200}
                          placeholder="Damaged in transit, short shipment…"
                          aria-label={`Reason for the difference on ${row.sku_number}`}
                          value={reasons[row.sku] ?? ''}
                          onChange={(event) => onReasonChange(row.sku, event.target.value)}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="receiving__side">
        <section className="card-panel">
          <h2 className="card-panel__title">Reconciliation Summary</h2>

          <dl className="fact-rows">
            <div>
              <dt>Total Expected Items</dt>
              <dd className="t-numeric">{formatQuantity(summary.totalExpected)} pcs</dd>
            </div>
            <div>
              <dt>Total Physical Count</dt>
              <dd className="t-numeric">{formatQuantity(summary.totalReceived)} pcs</dd>
            </div>
            <div>
              <dt>Net Discrepancy</dt>
              <dd
                className={`t-numeric${
                  summary.discrepancyCount > 0 ? ' fact-rows__value--warning' : ''
                }`}
              >
                {netDiscrepancyLabel(summary)}
              </dd>
            </div>
          </dl>

          {summary.discrepancyCount > 0 && (
            <p className="callout callout--warning">
              {summary.offsetting
                ? 'A shortage on one size is cancelling a surplus on another. The net is zero and two lines are still wrong.'
                : 'Discrepancy exists in individual size levels.'}{' '}
              This will result in receiving adjustments to {warehouseName} inventory.
            </p>
          )}
        </section>

        <section className="card-panel">
          <h2 className="card-panel__title">Reconciliation Notes</h2>
          <textarea
            className="input input--area"
            rows={5}
            aria-label="Reconciliation notes"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="What was wrong, and what was agreed with the driver."
          />
        </section>

        <section className="card-panel">
          <Button
            size="lg"
            full
            disabled={!anythingCounted || finalizing}
            onClick={onFinalize}
          >
            {finalizing ? 'Finalizing…' : 'Confirm & Finalize Receipt'}
          </Button>

          {!anythingCounted && (
            /*
              Visible text rather than a `title`: browsers suppress pointer
              events on a disabled button, so the tooltip explaining the dead
              end could never be read by the person stuck in it.
            */
            <p className="card-panel__note card-panel__note--warning">
              Every line is zero. Count at least one before finalizing — a
              delivery where nothing arrived is not a receipt.
            </p>
          )}
          <p className="card-panel__note">
            {/*
              Said plainly because it cannot be undone: the ledger is
              append-only, so a miscount is corrected with an inventory
              adjustment, not by posting again.
            */}
            Confirming raises stock at {warehouseName} immediately. It cannot be reversed —
            a miscount is corrected with an inventory adjustment.
          </p>
        </section>
      </div>
    </div>
  )
}
