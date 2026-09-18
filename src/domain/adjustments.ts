/**
 * Inventory adjustments — F23, F24, F25, F26, F27.
 *
 * The screens draw five "adjustment types". The server has two endpoints and
 * a lookup table, and the mapping between them is not one to one. This file
 * is that mapping, kept out of the components so it can be read and tested
 * on its own.
 *
 * ---------------------------------------------------------------------------
 * What the server actually has
 * ---------------------------------------------------------------------------
 *
 *   **Reason codes** are master data (F13). Central Office maintains the
 *   table; Finance may only read it. A code carries a `direction` —
 *   INCREASE or DECREASE — which is what turns a positive number somebody
 *   typed into a signed ledger figure. The person posting never chooses the
 *   sign.
 *
 *   **Every adjustment posts as one movement type**, ADJUSTMENT, whatever
 *   the code. Returns (F26) and damages (F27) are not separate documents;
 *   they are this document with RET or DMG on it.
 *
 *   **A physical count correction (F24) is not just another code.** Its
 *   requirement is that the system does the subtraction: you give it what
 *   was counted, it compares that to what it thinks is on hand and posts the
 *   difference against CORR_UP or CORR_DOWN itself. Hence its own endpoint
 *   and its own panel on the form.
 *
 *   **A warehouse transfer (F25) is not an adjustment at all.** Different
 *   endpoint, different permission — the matrix gives transfers to both
 *   leads as well as Finance, where every neighbouring feature is Finance
 *   only — and two ledger rows rather than one, because no money moves.
 *   Drawn as a fifth card because the design draws it there; it leads to the
 *   transfer screens.
 *
 * So a card picks a *family* of reason codes, not a single code. Today there
 * is one active code in each family, but the table is AsOne's to grow, and a
 * screen that hard-codes seven strings breaks the first time they add one.
 */

import type { IdentityTone, Tone } from '@/components'
import type { ReasonCode } from '@/api/types'

export type AdjustmentKind = 'RETURN' | 'TRANSFER' | 'LOSS' | 'DAMAGED' | 'CORRECTION'

export interface AdjustmentKindInfo {
  kind: AdjustmentKind
  /** The card's label, as drawn. */
  label: string
  /** One line under the label saying what it is for. */
  blurb: string
  /** Lucide icon name, resolved by the screen. */
  icon: string
  /**
   * Which reason codes belong to this card, by the prefix of their code.
   * Empty for the two kinds that do not choose a code: a transfer is a
   * different document, and a count correction has its code chosen by the
   * server from the direction of the difference.
   */
  codePrefixes: readonly string[]
}

export const ADJUSTMENT_KINDS: readonly AdjustmentKindInfo[] = [
  {
    kind: 'RETURN',
    label: 'Return',
    blurb: 'Goods coming back into stock.',
    icon: 'CornerUpLeft',
    codePrefixes: ['RET'],
  },
  {
    kind: 'TRANSFER',
    label: 'Warehouse Transfer',
    blurb: 'Stock moving between sites. No money moves.',
    icon: 'ArrowLeftRight',
    codePrefixes: [],
  },
  {
    kind: 'LOSS',
    label: 'Pick Up/Loss',
    blurb: 'Stock that cannot be found.',
    icon: 'MinusCircle',
    codePrefixes: ['LOSS'],
  },
  {
    kind: 'DAMAGED',
    label: 'Damaged',
    blurb: 'Written off as unsellable.',
    icon: 'AlertTriangle',
    codePrefixes: ['DMG'],
  },
  {
    kind: 'CORRECTION',
    label: 'Inventory Correction',
    blurb: 'A physical count that disagrees with the system.',
    icon: 'SlidersHorizontal',
    codePrefixes: ['CORR'],
  },
]

/** The active codes a given card may choose from. */
export function codesForKind(
  codes: readonly ReasonCode[],
  kind: AdjustmentKind,
): ReasonCode[] {
  const info = ADJUSTMENT_KINDS.find((entry) => entry.kind === kind)
  if (!info || info.codePrefixes.length === 0) return []

  return codes.filter(
    (code) =>
      code.is_active !== false &&
      info.codePrefixes.some((prefix) => code.code.startsWith(prefix)),
  )
}

/**
 * Which card a posted adjustment belongs to, read back from its code.
 *
 * Falls back to CORRECTION rather than throwing: a code AsOne adds later
 * should show as a row, not blank the table.
 */
export function kindOfCode(code: string | undefined): AdjustmentKind {
  if (!code) return 'CORRECTION'
  for (const info of ADJUSTMENT_KINDS) {
    if (info.codePrefixes.some((prefix) => code.startsWith(prefix))) return info.kind
  }
  if (code.startsWith('XFER')) return 'TRANSFER'
  return 'CORRECTION'
}

/** The uppercase word in the TYPE column. */
export function typeLabel(code: string | undefined): string {
  switch (kindOfCode(code)) {
    case 'RETURN':
      return 'RETURN'
    case 'TRANSFER':
      return 'TRANSFER'
    case 'LOSS':
      return 'LOSS'
    case 'DAMAGED':
      return 'DAMAGED'
    default:
      return 'CORRECTION'
  }
}

export function typeTone(code: string | undefined): Tone | IdentityTone {
  switch (kindOfCode(code)) {
    case 'RETURN':
      return 'info'
    case 'TRANSFER':
      return 'success'
    case 'LOSS':
      return 'error'
    case 'DAMAGED':
      return 'warning'
    default:
      return 'purple'
  }
}

/**
 * How many units this adjustment added or removed, signed.
 *
 * `quantity` on the wire is a magnitude — the direction lives on the reason
 * code, which the adjustment does not carry. So the codes table has to be to
 * hand, and when it is not this returns null rather than guessing a sign.
 * A "-5" printed where it should read "+5" is the one mistake this screen
 * must not make.
 */
export function signedQuantity(
  quantity: number,
  code: string | undefined,
  codes: readonly ReasonCode[],
): number | null {
  const match = codes.find((entry) => entry.code === code)
  if (!match) return null
  return match.direction === 'DECREASE' ? -quantity : quantity
}

/** "+12" / "−5". Minus sign, not hyphen. */
export function formatSigned(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`
}
