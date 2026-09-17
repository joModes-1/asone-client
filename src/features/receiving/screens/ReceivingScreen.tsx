/**
 * Receiving — F19, F20, F21.
 *
 * Owns the wizard's state and nothing else: the arithmetic is in
 * `domain/receiving`, the requests are in `api/procurement`, and each step
 * is a presentational component that takes what it draws.
 *
 * ## Why "Expected" is sent as the packing list quantity
 *
 * The server models three separate facts — what was ordered, what the
 * Tailoring Center's handwritten list claimed, and what was counted. This
 * screen collects two of them: the outstanding quantity on the production
 * order (Expected) and the physical count (Received).
 *
 * The design's step 2 captures the packing list as a *number* rather than a
 * per-SKU quantity, so there is no third column to fill. Expected is
 * therefore sent as `quantity_on_packing_list`, which makes the server's own
 * `discrepancy` the same figure as the Diff column on screen — the document
 * and the display cannot drift apart.
 *
 * **That is an assumption worth confirming with AsOne**: it reads the paper
 * as agreeing with the order. If a TC ever writes down a quantity that
 * differs from both the order and the count, this flow records two of those
 * three numbers and loses the middle one. Capturing it needs a per-SKU
 * column on step 2, which the design does not draw.
 */

import { useMemo, useState } from 'react'
import { LoadingScreen } from '@/components'
import { todayISO } from '@/domain/dates'
import { AppShell } from '@/features/shell/components/AppShell'
import { CompareStep, type CountsBySku, type ReasonsBySku } from '../components/CompareStep'
import { FinalManifest } from '../components/FinalManifest'
import { SelectOrderStep } from '../components/SelectOrderStep'
import { StepRail } from '../components/StepRail'
import {
  useFinalizeReceipt,
  useOpenProductionOrders,
  useOutstanding,
} from '../hooks/useReceiving'
import type { ReceivingStep } from '../steps'
import type { Receipt } from '@/api/types'

export function ReceivingScreen() {
  const [step, setStep] = useState<ReceivingStep>('order')
  const [orderId, setOrderId] = useState<number | null>(null)
  const [packingListNumber, setPackingListNumber] = useState('')
  const [carrierName, setCarrierName] = useState('')
  const [notes, setNotes] = useState('')
  /*
   * The finished receipt, and whether posting actually succeeded. Both,
   * because `useFinalizeReceipt` can return a created-but-unposted receipt:
   * the delivery is saved and stock was *not* raised. The heading has to say
   * which, or it contradicts the document printed underneath it.
   */
  const [posted, setPosted] = useState<{ receipt: Receipt; posted: boolean } | null>(null)

  const orders = useOpenProductionOrders()
  const outstanding = useOutstanding(orderId)
  const finalize = useFinalizeReceipt()

  const expected = useMemo(
    // Nothing still outstanding is nothing to receive, so those rows would
    // only be a row of zeroes to key past.
    () => (outstanding.data ?? []).filter((row) => row.outstanding > 0),
    [outstanding.data],
  )

  /*
   * Counts start at what the order expects: a clerk correcting the two lines
   * that are wrong is the common case, and a grid of zeroes invites a line
   * being missed entirely.
   *
   * Derived rather than seeded in an effect, and tagged with the order it
   * belongs to. An effect would have to re-seed on every change of `expected`
   * — one render behind, and wiping keyed counts if the query refetched
   * mid-count. Tagging makes switching order reset them for free.
   */
  const [draft, setDraft] = useState<{
    orderId: number | null
    counts: CountsBySku
    reasons: ReasonsBySku
  }>({
    orderId: null,
    counts: {},
    reasons: {},
  })

  const forThisOrder = draft.orderId === orderId

  const counts: CountsBySku = forThisOrder
    ? draft.counts
    : Object.fromEntries(expected.map((row) => [row.sku, row.outstanding]))

  /* Empty, unlike counts: a reason is something somebody writes, so there is
     nothing sensible to seed it with. Tagged with the order for the same
     reason counts are — switching order must not carry a note about a
     different delivery. */
  const reasons: ReasonsBySku = forThisOrder ? draft.reasons : {}

  function setCount(sku: number, value: number) {
    setDraft({ orderId, counts: { ...counts, [sku]: value }, reasons })
  }

  function setReason(sku: number, value: string) {
    setDraft({ orderId, counts, reasons: { ...reasons, [sku]: value } })
  }

  const order = orders.data?.find((candidate) => candidate.id === orderId) ?? null

  if (orders.isLoading) return <LoadingScreen message="Loading deliveries" />

  /*
   * A warehouse takes several deliveries a day, and the manifest was a dead
   * end: the only way out was the sidebar, which loses the flow. Clearing
   * every field rather than keeping the order — the next van is usually a
   * different one, and a pre-filled packing list number is the kind of
   * default that gets posted by accident.
   */
  function startAgain() {
    setPosted(null)
    setOrderId(null)
    setPackingListNumber('')
    setCarrierName('')
    setNotes('')
    setDraft({ orderId: null, counts: {}, reasons: {} })
    setStep('order')
  }

  function finalizeReceipt() {
    if (orderId === null) return

    finalize.mutate(
      {
        production_order: orderId,
        packing_list_number: packingListNumber.trim(),
        carrier_name: carrierName.trim() || undefined,
        date_received: todayISO(),
        notes: notes.trim() || undefined,
        lines: expected
          // The server refuses a count of zero, and rightly: "none of this
          // SKU arrived" is the absence of a line, not a line of nothing.
          .filter((row) => (counts[row.sku] ?? 0) > 0)
          .map((row) => {
            const reason = (reasons[row.sku] ?? '').trim()
            return {
              sku: row.sku,
              quantity_received: counts[row.sku] ?? 0,
              quantity_on_packing_list: row.outstanding,
              /* Omitted rather than sent empty. The field is optional on the
                 server and a line that matched has nothing to explain, so a
                 blank string would only put an empty note on every row. */
              ...(reason ? { discrepancy_note: reason } : {}),
            }
          }),
      },
      {
        onSuccess: (result) => {
          setPosted(result)
          setStep('confirm')
        },
      },
    )
  }

  return (
    <AppShell title="Receiving" searchHint="PO or center">
      {/* Controls and progress are chrome: the signed document is the only
          thing that should reach paper. */}
      <header className="page-head no-print">
        <h1 className="page-head__title">
          {step !== 'confirm'
            ? 'Receive Shipment'
            : posted?.posted
              ? 'Receipt Finalized'
              : 'Receipt Recorded — Not Posted'}
        </h1>
        <p className="page-head__subtitle">
          {step === 'compare'
            ? 'Input physical counts to match against the production manifest. Discrepancies are highlighted.'
            : step === 'confirm'
              ? posted?.posted
                ? 'The delivery is recorded and stock has been raised.'
                : 'The delivery is saved, but stock has not been raised. Post the receipt to inventory to complete it.'
              : 'Step-by-step verification of incoming goods from tailoring centers.'}
        </p>
      </header>

      <div className="step-rail-frame no-print">
        <StepRail current={step} />
      </div>

      {/*
        `isFetching`, not `isLoading`: a second delivery against the same
        order still has the rows cached from before the first was posted, and
        `isLoading` is false the whole time those stale figures are on screen.
      */}
      {step === 'order' && (
        <SelectOrderStep
          orders={orders.data ?? []}
          ordersLoading={orders.isLoading}
          orderId={orderId}
          onOrderChange={setOrderId}
          packingListNumber={packingListNumber}
          onPackingListNumberChange={setPackingListNumber}
          carrierName={carrierName}
          onCarrierNameChange={setCarrierName}
          expected={expected}
          expectedLoading={outstanding.isFetching}
          onContinue={() => setStep('compare')}
        />
      )}

      {step === 'compare' && order && (
        <CompareStep
          orderNumber={order.number}
          tailoringCenterName={order.tailoring_center_name}
          warehouseName={order.warehouse_name}
          expected={expected}
          counts={counts}
          reasons={reasons}
          onReasonChange={setReason}
          onCountChange={setCount}
          notes={notes}
          onNotesChange={setNotes}
          onFinalize={finalizeReceipt}
          finalizing={finalize.isPending}
        />
      )}

      {step === 'confirm' && posted && (
        <FinalManifest receipt={posted.receipt} onRecordAnother={startAgain} />
      )}
    </AppShell>
  )
}
