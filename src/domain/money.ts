/**
 * Money.
 *
 * UGX arrives from the server as a decimal string — "14400000.00" — and must
 * never become a JavaScript number on the way to arithmetic. Floating point
 * cannot hold 0.1 exactly, and a rounding error on a price becomes a wrong
 * invoice.
 *
 * ---------------------------------------------------------------------------
 * On summing
 * ---------------------------------------------------------------------------
 * Read totals from the API wherever one exists. `sumMoney` is here because
 * one figure the dashboard needs has no endpoint behind it: total inventory
 * value is the sum of a `value` column across stock-level rows, and the
 * server returns the rows without a total.
 *
 * So it sums in integer minor units, which is exact for two decimal places,
 * and returns a string in the same shape it received. It is not a licence to
 * recompute anything the server already knows — an invoice total, an order
 * line, a costed report.
 */

import type { Money } from '@/api/types'

/** Whole shillings. UGX has no circulating subunit, but the API sends 2dp. */
const SCALE = 100

function toMinorUnits(value: Money): bigint {
  const [whole, fraction = ''] = value.trim().split('.')
  const negative = whole.startsWith('-')
  const digits = `${whole.replace('-', '')}${fraction.padEnd(2, '0').slice(0, 2)}`
  const parsed = BigInt(digits || '0')
  return negative ? -parsed : parsed
}

function fromMinorUnits(minor: bigint): Money {
  const negative = minor < 0n
  const absolute = negative ? -minor : minor
  const whole = absolute / BigInt(SCALE)
  const fraction = absolute % BigInt(SCALE)
  return `${negative ? '-' : ''}${whole}.${fraction.toString().padStart(2, '0')}`
}

/** Exact. Sums decimal strings without ever touching a float. */
export function sumMoney(values: readonly Money[]): Money {
  return fromMinorUnits(values.reduce((total, value) => total + toMinorUnits(value), 0n))
}

/**
 * A unit price times a whole quantity — a line total.
 *
 * Multiplied in minor units, so 3 × "8333.33" is exactly "24999.99" rather
 * than whatever a float rounds to. `quantity` is a count and is truncated
 * to an integer: there is no such thing as half a shirt, and letting a
 * fraction through here would put one in a total.
 */
export function multiplyMoney(unit: Money, quantity: number): Money {
  return fromMinorUnits(toMinorUnits(unit) * BigInt(Math.trunc(quantity)))
}

/** Exact total across lines of a unit price and a quantity. */
export function sumLineTotals(
  lines: readonly { unit: Money; quantity: number }[],
): Money {
  return sumMoney(lines.map((line) => multiplyMoney(line.unit, line.quantity)))
}

/**
 * "UGX 25,000". Whole shillings, because that is how prices are quoted —
 * the API's trailing ".00" is an artefact of DecimalField, not a subunit
 * anyone counts.
 */
export function formatUGX(value: Money | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const minor = toMinorUnits(value)
  const whole = minor / BigInt(SCALE)
  return `UGX ${whole.toLocaleString('en-UG')}`
}

/**
 * "UGX 48.2M" — for a KPI tile, where the exact figure is less use than its
 * order of magnitude and the space is tight.
 *
 * Deliberately separate from `formatUGX`: a tile may round, a document may
 * not, and keeping them apart stops an abbreviated figure reaching an
 * invoice.
 */
export function formatCompactUGX(value: Money | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'

  const whole = toMinorUnits(value) / BigInt(SCALE)
  const abs = whole < 0n ? -whole : whole
  const sign = whole < 0n ? '-' : ''

  const units: [bigint, string][] = [
    [1_000_000_000n, 'B'],
    [1_000_000n, 'M'],
    [1_000n, 'K'],
  ]

  for (const [threshold, suffix] of units) {
    if (abs >= threshold) {
      // One decimal place, computed in integers then placed by hand so no
      // float division is involved.
      const tenths = (abs * 10n) / threshold
      const head = tenths / 10n
      const tail = tenths % 10n
      const body = tail === 0n ? `${head}` : `${head}.${tail}`
      return `UGX ${sign}${body}${suffix}`
    }
  }

  return `UGX ${sign}${abs.toLocaleString('en-UG')}`
}

/** "16,482" — quantities, which are integers and safe as numbers. */
export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-UG')
}

/**
 * "+120" or "-15" — a ledger movement's signed quantity (see `StockMovement`:
 * positive into the warehouse, negative out of it). `formatQuantity` alone
 * drops the sign on a positive number, which is the one case a movement
 * ledger cannot afford to be ambiguous about.
 */
export function formatSignedQuantity(value: number): string {
  return value > 0 ? `+${formatQuantity(value)}` : formatQuantity(value)
}
