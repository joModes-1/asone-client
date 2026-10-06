/**
 * Reading a stock-count sheet.
 *
 * Lives here rather than beside the dialogue so it can be tested directly,
 * and because what it accepts has to keep matching what Export CSV writes.
 * Those two drifted apart once: the export had SKU and Warehouse and no
 * Counted column, so exporting the inventory and importing it straight back
 * — the first thing anybody tries — failed outright.
 */

/**
 * The columns Export CSV writes, and the single statement of them.
 *
 * `InventoryScreen` imports this rather than listing them inline, so the
 * sheet it produces and the sheet this file reads cannot drift apart again.
 * They did once, and exporting the inventory and importing it straight back
 * — the first thing anybody tries — failed outright.
 *
 * `Counted` is written empty, between the identity columns and the system's
 * own figures: where somebody walking the shelves writes, with Available
 * beside it to compare against.
 */
export const INVENTORY_EXPORT_HEADERS = [
  'SKU',
  'Garment',
  'Description',
  'Level',
  'Size',
  'Color',
  'Warehouse',
  'Counted',
  'Available',
  'Pick',
  'Shipped',
  'Min. Stock',
  'Value',
] as const

export interface ParsedRow {
  line: number
  sku: string
  warehouse: string
  counted: number
}

/**
 * A deliberately small CSV reader: split on newlines, then on commas.
 *
 * No quoting, no embedded commas — a stock count is three short columns and
 * a parser that handles every edge of RFC 4180 would be more code than the
 * feature. A file it cannot read fails loudly at the matching step rather
 * than being half-understood.
 */
export function parseCsv(text: string): { rows: ParsedRow[]; error: string | null } {
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
        'The first row must name the columns, and must include one called SKU ' +
        'and one called Counted. Export CSV from this screen gives you a sheet ' +
        'with both, and a blank Counted column to fill in.',
    }
  }

  const rows = lines.slice(1).map((line, index) => {
    const cells = line.split(',').map((cell) => cell.trim())
    const raw = cells[countAt] ?? ''

    return {
      line: index + 2,
      sku: cells[skuAt] ?? '',
      warehouse: whAt === -1 ? '' : (cells[whAt] ?? ''),
      /*
       * An empty cell is "not counted", and is deliberately NaN rather than
       * what `Number('')` gives, which is 0.
       *
       * Zero is a real count — a shelf somebody looked at and found empty —
       * and the difference matters enormously: it posts an adjustment
       * writing the stock down to nothing. `Number.isFinite(0)` is true, so
       * a blank sailed through as a counted zero and the row below marked it
       * good. Exporting the sheet and importing it back without filling
       * anything in would have zeroed every row on it.
       */
      counted: raw === '' ? Number.NaN : Number(raw),
    }
  })

  return { rows, error: null }
}
