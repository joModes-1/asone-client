/**
 * The cohort a kit is cut for: class band, gender, day or boarder, and size.
 *
 * AsOne's 2027 catalogue has 120 kits and these four are exactly what tell
 * them apart — 5 bands × 2 genders × 2 residences × 6 sizes. They used to
 * live inside the kit's *name* ("Nursery Boy, Day — XS"), which meant two
 * genuinely different kits differed only by a string and nothing could
 * filter by any of it.
 *
 * ---------------------------------------------------------------------------
 * A mirror, not the rule
 * ---------------------------------------------------------------------------
 * The codes, the labels and the composed number all come from
 * `catalog/models/kits.py` and `catalog.services.kit_number()`. The server
 * composes the number it stores; this composes the same string so the form
 * can *show* what is about to be assigned before anything is saved. If the
 * two ever disagree the server wins — what the kit carries afterwards is
 * whatever came back from it, which is what every screen reads.
 *
 * The labels are not fetched from the schema because a `<select>` needs them
 * before any kit exists, and these five bands are the ones in AsOne's own
 * workbook rather than a list that grows by itself.
 */

/** Which price list each band draws from — `Kit.PRICE_LIST_BY_FIT_GROUP`. */
export const KIT_FIT_GROUPS = [
  { value: 'NUR', label: 'Nursery', level: 'PS' },
  { value: 'P14', label: 'Lower Primary (P1–P4)', level: 'PS' },
  { value: 'P57', label: 'Upper Primary (P5–P7)', level: 'PS' },
  { value: 'S14', label: 'O Level (S1–S4)', level: 'HS' },
  { value: 'S56', label: 'A Level (S5–S6)', level: 'HS' },
] as const

export const KIT_GENDERS = [
  { value: 'B', label: 'Boy' },
  { value: 'G', label: 'Girl' },
] as const

export const KIT_RESIDENCES = [
  { value: 'DAY', label: 'Day' },
  { value: 'BRD', label: 'Boarder' },
] as const

export interface KitCohort {
  fitGroup: string
  gender: string
  residence: string
  /** The size's *name* — "XS" — not its id. The number is built from it. */
  sizeName: string | null
}

/**
 * Which price list a band belongs on, or null for no band.
 *
 * The server derives `school_level` from `fit_group` on save, so the form
 * never asks for both — it shows this, read-only, beside the band.
 */
export function priceListFor(fitGroup: string): string | null {
  return KIT_FIT_GROUPS.find((band) => band.value === fitGroup)?.level ?? null
}

export function fitGroupLabel(fitGroup: string): string {
  return KIT_FIT_GROUPS.find((band) => band.value === fitGroup)?.label ?? fitGroup
}

/**
 * The number the server will assign — `KIT-NUR-B-DAY-XS`.
 *
 * Null until all four parts are stated, because a half-composed number is
 * not a number and showing `KIT-NUR--DAY-` reads as a bug in the form.
 */
export function composeKitNumber(cohort: Partial<KitCohort>): string | null {
  const { fitGroup, gender, residence, sizeName } = cohort
  if (!fitGroup || !gender || !residence || !sizeName) return null

  // Matches `catalog.services.kit_number()`: letters and digits only, upper
  // case — so a size somebody typed as "XS " or "x-s" still gives "XS".
  const size = sizeName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (!size) return null

  return ['KIT', fitGroup, gender, residence, size].join('-')
}

/** "Nursery · Boy · Day · XS", for a card or a detail line. Null if no cohort. */
export function describeCohort(kit: {
  fit_group_display?: string
  gender_display?: string
  residence_display?: string
  size_name?: string | null
}): string | null {
  const parts = [
    kit.fit_group_display,
    kit.gender_display,
    kit.residence_display,
    kit.size_name,
  ].filter((part): part is string => Boolean(part))

  return parts.length === 0 ? null : parts.join(' · ')
}

/**
 * May this SKU go into a kit cut for this cohort?
 *
 * Mirrors `KitItem.clean()`, so the picker offers only what the server will
 * accept. Three rules, each with the same shape — the kit's own value, or
 * the one that spans every value:
 *
 *   * **Price list.** A garment marked BOTH fits either kit.
 *   * **Class band.** A garment marked ALL — socks, neckties — fits any
 *     band. This is the one the level rule cannot do: Nursery, P1–P4 and
 *     P5–P7 are all Primary, so filtering on the level alone offered an
 *     Upper Primary sweater for a Nursery kit.
 *   * **Size.** A one-size item goes into a kit of any size.
 *
 * Measured against AsOne's own 2027 bill of materials rather than guessed:
 * of its 828 component lines, 120 are a band other than their kit's and all
 * 120 are ALL items; 144 are another size and all 144 are one-size items.
 *
 * A kit stating no band or no size does not check that rule — the general
 * kits predate the fields, and refusing them would strand them.
 */
export function fitsKit(
  sku: {
    garment_school_level?: string
    garment_fit_group?: string
    size?: number
    size_is_one_size?: boolean
  },
  kit: { level: string; fitGroup: string; sizeId: number | null },
): boolean {
  if (sku.garment_school_level !== kit.level && sku.garment_school_level !== 'BOTH') {
    return false
  }

  if (kit.fitGroup && sku.garment_fit_group) {
    if (sku.garment_fit_group !== kit.fitGroup && sku.garment_fit_group !== 'ALL') {
      return false
    }
  }

  if (kit.sizeId !== null && sku.size !== kit.sizeId && !sku.size_is_one_size) {
    return false
  }

  return true
}
