/**
 * What a SKU's number will be, for the preview on the create-a-SKU form.
 *
 * ---------------------------------------------------------------------------
 * This mirrors the server and must keep mirroring it
 * ---------------------------------------------------------------------------
 * `catalog/services.py: sku_code()` is where the real number is composed, on
 * save. Nothing here is sent anywhere — the server ignores any number a
 * client supplies, because `Sku.number` is not editable. This exists only so
 * the form can show what is about to happen.
 *
 * It lives in `domain/` with a test rather than inline in the modal, which is
 * where the rule used to be. Inline, it was a hard-coded `code-SIZE` that
 * nobody updated when the five-part shape arrived, so the preview promised
 * `SWE-XL` for a garment the server would have numbered
 * `UNI-P14-SWT-XL-GRY`. A preview that disagrees with the result is worse
 * than no preview.
 */

import type { Garment } from '@/api/types'

/** The first segment of every five-part number. See `SKU_PREFIX` on the server. */
export const SKU_PREFIX = 'UNI'

/**
 * Non-alphanumerics are stripped from the size, so a size named "XL-TALL"
 * does not put an extra hyphen in the number and make it look like it has
 * more parts than it does.
 */
function sizeToken(sizeName: string): string {
  return sizeName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

/**
 * `UNI-NUR-CHS-XS-CHK` where the garment carries a fit group and a colour
 * code, and the two-part `GTR-L` where it does not.
 *
 * The fallback is not a bug: SKU numbers are frozen once assigned, because
 * they are printed on shelf labels, so garments that predate those fields
 * keep producing the shape their existing SKUs already carry.
 */
export function previewSkuNumber(
  garment: Pick<Garment, 'code' | 'fit_group' | 'colour_code'> | null | undefined,
  sizeName: string | null | undefined,
): string | null {
  if (!garment?.code || !sizeName) return null

  const size = sizeToken(sizeName)
  if (!size) return null

  if (garment.fit_group && garment.colour_code) {
    return [
      SKU_PREFIX,
      garment.fit_group,
      garment.code,
      size,
      garment.colour_code.toUpperCase(),
    ].join('-')
  }

  return `${garment.code}-${size}`
}
