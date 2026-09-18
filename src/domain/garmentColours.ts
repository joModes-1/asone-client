/**
 * The colours a garment can be, and the dot that stands for each.
 *
 * `Garment.colour` is free text on the server — a lead typed it — so this is
 * not a constraint, it is the set the app knows how to draw. A name with no
 * entry here still saves and still shows; it just gets the unknown swatch
 * rather than a guess.
 *
 * One list, used by both the picker in the garment form and the dot on the
 * SKU form. They used to be two copies of the same `if` chain, which is how
 * a colour ends up pickable but undrawable.
 *
 * The values are tokens, never hexes — see "Garment colours" in tokens.css.
 */

export interface GarmentColour {
  /** What is stored on the garment, and what the description reads. */
  name: string
  /** The CSS custom property the dot is filled with. */
  token: string
}

export const GARMENT_COLOURS: readonly GarmentColour[] = [
  { name: 'White', token: 'var(--garment-white)' },
  { name: 'Blue', token: 'var(--garment-blue)' },
  { name: 'Navy', token: 'var(--garment-navy)' },
  { name: 'Green', token: 'var(--garment-green)' },
  { name: 'Grey', token: 'var(--garment-grey)' },
  { name: 'Maroon', token: 'var(--garment-maroon)' },
  { name: 'Black', token: 'var(--garment-black)' },
]

/**
 * The dot for a colour name.
 *
 * Matched on the name containing the entry rather than equalling it, because
 * the field is free text: "Navy Blue" is navy, and must be tested before
 * "Blue" or it would come out the wrong colour. The list is ordered so the
 * more specific names come first.
 */
/**
 * The dot for a garment, preferring what was actually chosen.
 *
 * A garment created since the colour picker landed carries its own hex, and
 * that is the truth — it is the shade somebody looked at and picked. Only a
 * garment created before it falls back to matching the name against the
 * presets, and only then to the neutral.
 */
export function swatchFor(garment: {
  colour?: string
  colour_hex?: string
}): string {
  if (garment.colour_hex) return garment.colour_hex
  return garmentSwatch(garment.colour ?? '')
}

export function isKnownColour(colour: string): boolean {
  return garmentSwatch(colour) !== 'var(--garment-unknown)'
}

export function garmentSwatch(colour: string): string {
  const needle = colour.trim().toLowerCase()
  if (!needle) return 'var(--garment-unknown)'

  const ordered = [...GARMENT_COLOURS].sort((a, b) => b.name.length - a.name.length)
  const hit = ordered.find((entry) => needle.includes(entry.name.toLowerCase()))

  // "Gray" is the same colour spelt the other way.
  if (!hit && (needle.includes('gray'))) return 'var(--garment-grey)'

  return hit ? hit.token : 'var(--garment-unknown)'
}
