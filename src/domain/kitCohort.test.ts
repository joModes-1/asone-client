import { describe, expect, it } from 'vitest'
import {
  composeKitNumber,
  describeCohort,
  fitsKit,
  priceListFor,
} from './kitCohort'

describe('composeKitNumber', () => {
  const nurseryBoyDay = {
    fitGroup: 'NUR',
    gender: 'B',
    residence: 'DAY',
    sizeName: 'XS',
  }

  it('matches the number AsOne use in their own workbook', () => {
    expect(composeKitNumber(nurseryBoyDay)).toBe('KIT-NUR-B-DAY-XS')
  })

  it('follows a change of residence', () => {
    expect(composeKitNumber({ ...nurseryBoyDay, residence: 'BRD' })).toBe(
      'KIT-NUR-B-BRD-XS',
    )
  })

  it('is null until all four parts are stated', () => {
    expect(composeKitNumber({ ...nurseryBoyDay, gender: '' })).toBeNull()
    expect(composeKitNumber({ ...nurseryBoyDay, sizeName: null })).toBeNull()
    expect(composeKitNumber({})).toBeNull()
  })

  it('strips what the server strips from a size', () => {
    expect(composeKitNumber({ ...nurseryBoyDay, sizeName: ' x-s ' })).toBe(
      'KIT-NUR-B-DAY-XS',
    )
  })
})

describe('priceListFor', () => {
  it('puts the three primary bands on the Primary list', () => {
    expect(['NUR', 'P14', 'P57'].map(priceListFor)).toEqual(['PS', 'PS', 'PS'])
  })

  it('puts both secondary bands on the High School list', () => {
    expect(['S14', 'S56'].map(priceListFor)).toEqual(['HS', 'HS'])
  })

  it('is null where no band is stated', () => {
    expect(priceListFor('')).toBeNull()
  })
})

describe('describeCohort', () => {
  it('reads as a sentence of parts', () => {
    expect(
      describeCohort({
        fit_group_display: 'Nursery',
        gender_display: 'Boy',
        residence_display: 'Day',
        size_name: 'XS',
      }),
    ).toBe('Nursery · Boy · Day · XS')
  })

  it('is null for a kit that states no cohort', () => {
    expect(describeCohort({ fit_group_display: '', size_name: null })).toBeNull()
  })
})

describe('fitsKit', () => {
  const nurseryKitXs = { level: 'PS', fitGroup: 'NUR', sizeId: 1 }
  const nurseryShirt = {
    garment_school_level: 'PS',
    garment_fit_group: 'NUR',
    size: 1,
    size_is_one_size: false,
  }

  it('accepts a garment of the kit’s own band and size', () => {
    expect(fitsKit(nurseryShirt, nurseryKitXs)).toBe(true)
  })

  it('accepts the socks — any band, any size', () => {
    const socks = {
      garment_school_level: 'BOTH',
      garment_fit_group: 'ALL',
      size: 99,
      size_is_one_size: true,
    }

    expect(fitsKit(socks, nurseryKitXs)).toBe(true)
  })

  it('refuses another band, even on the same price list', () => {
    expect(
      fitsKit({ ...nurseryShirt, garment_fit_group: 'P57' }, nurseryKitXs),
    ).toBe(false)
  })

  it('refuses another size', () => {
    expect(fitsKit({ ...nurseryShirt, size: 2 }, nurseryKitXs)).toBe(false)
  })

  it('refuses the other price list', () => {
    expect(
      fitsKit({ ...nurseryShirt, garment_school_level: 'HS' }, nurseryKitXs),
    ).toBe(false)
  })

  it('checks only the price list for a kit stating no band or size', () => {
    const general = { level: 'PS', fitGroup: '', sizeId: null }

    expect(fitsKit({ ...nurseryShirt, garment_fit_group: 'P57', size: 7 }, general)).toBe(
      true,
    )
  })
})
