/**
 * Garment catalogue naming — the two places the app decides how a piece of
 * catalogue data reads, rather than each screen deciding for itself.
 */

import type { GarmentSchoolLevel } from '@/api/types'

/**
 * Which school level a garment belongs to, in words.
 *
 * `PS` and `HS` are what the server stores and what a price list is keyed
 * on; neither is a thing to put in front of a reader. This lived as a local
 * `LEVEL_LABEL` map inside the garments table, so the price list's gap
 * report printed the raw `BOTH` — two screens, one fact, one of them saying
 * it in enum.
 *
 * "Both" means the garment appears on each list, not that there is a third
 * list.
 */
export function schoolLevelLabel(level: GarmentSchoolLevel | null | undefined): string {
  switch (level) {
    case 'PS':
      return 'Primary'
    case 'HS':
      return 'High School'
    case 'BOTH':
      return 'Both'
    default:
      return '—'
  }
}

/**
 * Strips the word "size" if somebody types it.
 *
 * Not a validation error, because typing "Size 10" is the natural thing to
 * do and refusing it would be pedantry. The word is added wherever a size is
 * shown — the server composes descriptions as `… size {name}`, and the
 * pickers prefix it too — so a size stored as "Size 10" reads "size Size 10"
 * on a pick list. Taking the word off is what the person meant.
 *
 * Only a *leading* "size" goes, so "E2E-12" and "S" are untouched and a
 * hypothetical size genuinely called "Oversize" keeps its name.
 */
export function cleanSizeName(raw: string): string {
  return raw.replace(/^\s*sizes?\s+/i, '').trim()
}
