/**
 * The stock-count sheet, and the round trip that has to keep working.
 *
 * Export CSV writes a sheet; Import stock count reads one. They are written
 * in two different files and nothing but this test holds them together —
 * they drifted apart once, and exporting the inventory and importing it
 * straight back failed with "must include one called SKU and one called
 * Counted", which is the one round trip anybody would try first.
 *
 * `EXPORT_HEADER` is a copy of what `InventoryScreen.handleExport` writes.
 * Change that and this fails, which is the point.
 */

import { describe, expect, it } from 'vitest'
import { parseCsv } from './stockCount'
import { toCsv } from './csv'
import { INVENTORY_EXPORT_HEADERS } from './stockCount'

const EXPORT_HEADER =
  'SKU,Garment,Description,Level,Size,Color,Warehouse,Counted,Available,Pick,Shipped,Min. Stock,Value'

const row = (counted: string) =>
  `UNI-NUR-CHS-XS-CHK,Checked Shirt,desc,PS,XS,Checked,Namayemba,${counted},12,0,0,5,120000`

describe('the stock count sheet', () => {
  it('reads the sheet Export CSV produces', () => {
    const result = parseCsv(`${EXPORT_HEADER}\n${row('47')}`)

    expect(result.error).toBeNull()
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].sku).toBe('UNI-NUR-CHS-XS-CHK')
    expect(result.rows[0].warehouse).toBe('Namayemba')
  })

  it('takes the count from Counted, never from Available', () => {
    /* Available sits right beside it and holds what the system already
       thinks. Reading that back would post no differences at all while
       looking exactly like a stock take had been done. */
    const result = parseCsv(`${EXPORT_HEADER}\n${row('47')}`)

    expect(result.rows[0].counted).toBe(47)
  })

  it('treats an unfilled row as not counted, never as counted zero', () => {
    /* The one that matters. `Number('')` is 0 and `Number.isFinite(0)` is
       true, so a blank used to arrive as a real count of nothing — and
       importing an unfilled export would have posted an adjustment zeroing
       every row on it. Zero is a shelf somebody looked at; blank is a shelf
       nobody reached. */
    const result = parseCsv(`${EXPORT_HEADER}\n${row('')}`)

    expect(result.rows[0].counted).toBeNaN()
  })

  it('still reads a genuine zero as a count', () => {
    const result = parseCsv(`${EXPORT_HEADER}\n${row('0')}`)

    expect(result.rows[0].counted).toBe(0)
  })

  it('still refuses a file with no count column at all', () => {
    const noCount =
      'SKU,Garment,Description,Level,Size,Color,Warehouse,Available,Pick,Shipped,Min. Stock,Value'

    const result = parseCsv(`${noCount}\nSKU1,g,d,PS,XS,c,Namayemba,12,0,0,5,1`)

    expect(result.error).toContain('Counted')
    expect(result.rows).toHaveLength(0)
  })

  it('accepts the other words people title that column with', () => {
    for (const heading of ['Counted', 'Count', 'Quantity', 'Qty']) {
      const result = parseCsv(`SKU,Warehouse,${heading}\nSKU1,Namayemba,9`)
      expect(result.error, heading).toBeNull()
      expect(result.rows[0].counted, heading).toBe(9)
    }
  })

  it('says where to get a sheet rather than only what is wrong', () => {
    const result = parseCsv('Nothing,Useful\na,b')

    expect(result.error).toContain('Export CSV')
  })
})

describe('the real export, read by the real parser', () => {
  /*
   * Both halves for real: `toCsv` as the screen calls it, and `parseCsv` as
   * the dialogue calls it. A hand-typed header would have missed that
   * `toCsv` prepends a byte-order mark and ends lines with CRLF — the two
   * things most likely to break a reader that splits on commas and newlines.
   */
  const exported = toCsv(INVENTORY_EXPORT_HEADERS, [
    ['UNI-NUR-CHS-XS-CHK', 'Checked Shirt', 'desc', 'PS', 'XS', 'Checked', 'Namayemba', '', 12, 0, 0, 5, '120000.00'],
    ['UNI-NUR-CHS-S-CHK', 'Checked Shirt', 'desc', 'PS', 'S', 'Checked', 'Serere', '', null, null, 0, null, null],
  ])

  it('round-trips without the error anybody hit first', () => {
    const result = parseCsv(exported)

    expect(result.error).toBeNull()
    expect(result.rows).toHaveLength(2)
  })

  it('survives the byte-order mark toCsv writes', () => {
    expect(exported.startsWith('\ufeff')).toBe(true)
    expect(parseCsv(exported).rows[0].sku).toBe('UNI-NUR-CHS-XS-CHK')
  })

  it('reads the warehouse, so a count lands at the right site', () => {
    const result = parseCsv(exported)

    expect(result.rows[0].warehouse).toBe('Namayemba')
    expect(result.rows[1].warehouse).toBe('Serere')
  })

  it('leaves every row uncounted until somebody fills the column in', () => {
    for (const row of parseCsv(exported).rows) {
      expect(row.counted).toBeNaN()
    }
  })
})
