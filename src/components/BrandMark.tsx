/**
 * The AsOne mark.
 *
 * The asset is the vectorised logo exported from Figma at its designed
 * 158×70. Both dimensions are set explicitly rather than letting one derive
 * from `auto`, so the mark cannot drift out of proportion inside a flex
 * parent — it scales by ratio from a single `width`.
 */

import logoUrl from '@/assets/brand/asone-logo.png'

/** Designed geometry. Any other size is derived from this ratio. */
const NATURAL_WIDTH = 158
const NATURAL_HEIGHT = 70

interface BrandMarkProps {
  /** Rendered width in px. Height follows the designed aspect ratio. */
  width?: number
  /**
   * The mark is decorative wherever the product name is already in the text
   * beside it. Pass a label only when it is the sole identifier.
   */
  label?: string
}

export function BrandMark({ width = NATURAL_WIDTH, label }: BrandMarkProps) {
  const height = Math.round((width / NATURAL_WIDTH) * NATURAL_HEIGHT)

  return (
    <img
      src={logoUrl}
      width={width}
      height={height}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      style={{ display: 'block' }}
    />
  )
}
