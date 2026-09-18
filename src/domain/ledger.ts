/**
 * The stock ledger — F48, the audit trail.
 *
 * `movementTone` already lives in `domain/status` with the other status
 * colours. What is here is the rest of what a ledger row needs before it can
 * be drawn.
 *
 * ---------------------------------------------------------------------------
 * Why the labels are here rather than `movement_type_display`
 * ---------------------------------------------------------------------------
 * Every row carries `movement_type_display`, Django's own label for the
 * choice, and using it was the first instinct: one source, no drift.
 *
 * It does not work, for a reason worth writing down. A **filter** has to name
 * the types before any row has come back, so its options cannot come from a
 * row — they have to be listed somewhere. Take the labels off the row and the
 * screen says two different things about one movement: the picker offers
 * "Pick", the badge beside it reads "Picked for a school order". Nobody
 * should have to work out that those are the same thing.
 *
 * So both come from here. The server's labels are sentences meant for a
 * document; a column that repeats one on every row is a column of prose. What
 * a table wants is the name of the thing.
 */

import type { MovementType, StockStatus } from '@/api/types'

export interface MovementTypeInfo {
  type: MovementType
  label: string
}

/**
 * The eight movement types, grouped by what they mean rather than
 * alphabetically: goods arriving, goods leaving, and the two corrections.
 *
 * Sorting by name would put "Adjustment, Damage, Pick, Receipt, Return…" in
 * the list — the two ends of the same journey at opposite ends of the menu.
 */
export const MOVEMENT_TYPES: readonly MovementTypeInfo[] = [
  { type: 'RECEIPT', label: 'Receipt' },
  { type: 'TRANSFER_IN', label: 'Transfer in' },
  { type: 'RETURN', label: 'Return' },
  { type: 'PICK', label: 'Pick' },
  { type: 'SHIPMENT', label: 'Shipment' },
  { type: 'TRANSFER_OUT', label: 'Transfer out' },
  { type: 'ADJUSTMENT', label: 'Adjustment' },
  { type: 'DAMAGE', label: 'Damage' },
]

/**
 * What kind of document a ledger row's `document_number` names.
 *
 * ---------------------------------------------------------------------------
 * Why a prefix and not a link
 * ---------------------------------------------------------------------------
 * `document_number` is a plain string on the ledger and deliberately so — the
 * ledger outlives any one document type and must not gain a nullable foreign
 * key per app that writes to it. So all the reader has is the number.
 *
 * A prefix can say what *kind* of document it is, because each issuing app
 * stamps its own and never reuses another's. It cannot say *where* that
 * document is: the detail routes are keyed by database id, and a school order
 * screen reached from `SO-100031` would need a lookup this has no business
 * doing. So this names the document and stops there, rather than linking
 * somewhere approximate.
 *
 * The five prefixes are the ones the server actually issues — `RC-` receipts
 * (`procurement/services.py`), `SH-` shipments (`orders/services/shipping`),
 * `ADJ-` and `WT-` (`inventory/services`), `SO-` school orders. An unknown
 * prefix returns null and the number is shown bare, which is what should
 * happen when a sixth app starts writing to the ledger.
 */
export function documentKind(documentNumber: string): string | null {
  const prefix = documentNumber.trim().toUpperCase().split('-')[0]

  switch (prefix) {
    case 'RC':
      return 'Receipt'
    case 'SH':
      return 'Shipment'
    case 'ADJ':
      return 'Adjustment'
    case 'WT':
      return 'Transfer'
    case 'SO':
      return 'School order'
    default:
      return null
  }
}

const LABELS = new Map<MovementType, string>(
  MOVEMENT_TYPES.map((info) => [info.type, info.label]),
)

/**
 * What to print in a movement's badge — the same word the filter offers.
 *
 * Falls back to the raw type rather than to `movement_type_display`, so a
 * ninth movement type added on the server shows up as `RESERVATION` — ugly,
 * obviously unfinished, and impossible to mistake for a label somebody chose.
 * Quietly borrowing the server's sentence would hide the omission instead.
 */
export function movementLabel(type: MovementType): string {
  return LABELS.get(type) ?? type
}

/**
 * Which pot of stock the movement landed in — `stock_status` on the row.
 *
 * This column is what stops the ledger reading as nonsense. A pick posts two
 * rows at one warehouse on one day: −544 out of AVAILABLE and +544 into PICK.
 * Without the status those are a contradiction on screen — the same document
 * apparently adding and removing the same units. With it they are what they
 * are, which is stock reserved rather than stock gone.
 */
export function stockStatusLabel(status: StockStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'Available'
    case 'PICK':
      return 'Reserved'
    case 'SHIPPED':
      return 'Shipped'
  }
}
