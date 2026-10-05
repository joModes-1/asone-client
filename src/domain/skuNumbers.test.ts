import { describe, expect, it } from 'vitest'
import { previewSkuNumber } from './skuNumbers'

type Preview = Parameters<typeof previewSkuNumber>[0]

const full = { code: 'CHS', fit_group: 'NUR', colour_code: 'CHK' } as Preview
const legacy = { code: 'SWE', fit_group: '', colour_code: '' } as Preview

describe('previewSkuNumber', () => {
  it('composes the five parts AsOne use', () => {
    expect(previewSkuNumber(full, 'XS')).toBe('UNI-NUR-CHS-XS-CHK')
  })

  it('falls back to two parts for a garment with no fit group or colour code', () => {
    expect(previewSkuNumber(legacy, 'XL')).toBe('SWE-XL')
  })

  it('needs both halves before it will use the long form', () => {
    expect(previewSkuNumber({ code: 'SWT', fit_group: 'P14', colour_code: '' } as Preview, 'M')).toBe(
      'SWT-M',
    )
    expect(previewSkuNumber({ code: 'SWT', fit_group: '', colour_code: 'GRY' } as Preview, 'M')).toBe(
      'SWT-M',
    )
  })

  it('strips punctuation out of the size so the parts stay countable', () => {
    expect(previewSkuNumber(full, 'XL-TALL')).toBe('UNI-NUR-CHS-XLTALL-CHK')
  })

  it('upper-cases a colour code typed in lower case', () => {
    expect(previewSkuNumber({ code: 'CHS', fit_group: 'NUR', colour_code: 'chk' } as Preview, 'S')).toBe(
      'UNI-NUR-CHS-S-CHK',
    )
  })

  it('says nothing until there is something to say', () => {
    expect(previewSkuNumber(null, 'XS')).toBeNull()
    expect(previewSkuNumber(full, null)).toBeNull()
    expect(previewSkuNumber(full, '')).toBeNull()
  })
})
