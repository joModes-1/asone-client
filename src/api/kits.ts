/**
 * Uniform kits — F07, F33.
 *
 * A kit is a bundle of SKUs a school orders as one line: "Primary School
 * Kit" rather than two shirts, two shorts, a sweater and socks. It is a
 * **convenience for ordering, not a thing that exists in a warehouse.**
 *
 * F33 is the rule that follows: the moment a kit is ordered it becomes its
 * component SKUs, and from there on every part of the system — availability,
 * picking, packing, shipping, the ledger — deals in SKUs alone. Nothing ever
 * counts a kit on a shelf, and no warehouse is ever asked to find one.
 *
 * ---------------------------------------------------------------------------
 * A kit has no price of its own
 * ---------------------------------------------------------------------------
 * `current_price` is the sum of its components' prices today, computed fresh
 * on every read. There is no field to edit and no bundle discount — the kit
 * detail screen says so on the page, because it is the first thing anyone
 * assumes otherwise.
 *
 * It is `null`, not zero, where the sum cannot be taken: a component with no
 * price on today's list, or a kit with no components yet. Zero would be a
 * figure somebody could act on.
 */

import { del, get, patch, post } from './http'
import type { Kit, KitItem, Page } from './types'

export type KitFilters = {
  school_level?: string
  is_active?: boolean
  page?: number
  page_size?: number
}

export function kits(params?: KitFilters) {
  return get<Page<Kit>>('/catalog/kits/', params ?? undefined)
}

export function kit(id: number) {
  return get<Kit>(`/catalog/kits/${id}/`)
}

/**
 * A kit's bill of materials.
 *
 * Its own endpoint rather than nested on the kit, which is why the list
 * screen fetches every line once and groups them rather than asking per
 * card: AsOne has a handful of kits, so one request beats N.
 */
export function kitItems(kitId?: number) {
  return get<Page<KitItem>>('/catalog/kit-items/', kitId ? { kit: kitId } : undefined)
}

export interface KitInput {
  kit_number: string
  name: string
  /** Who this kit is for, in a sentence. Shown to schools choosing one. */
  description?: string
  /** "PS" or "HS". A kit is for one level — there is no "both". */
  school_level: string
  is_active?: boolean
}

export function createKit(input: KitInput) {
  return post<Kit>('/catalog/kits/', input)
}

export function updateKit(id: number, input: Partial<KitInput>) {
  return patch<Kit>(`/catalog/kits/${id}/`, input)
}

export function addKitItem(input: { kit: number; sku: number; quantity: number }) {
  return post<KitItem>('/catalog/kit-items/', input)
}

export function updateKitItem(id: number, quantity: number) {
  return patch<KitItem>(`/catalog/kit-items/${id}/`, { quantity })
}

/**
 * Removing a component is a real delete, unlike almost everything else here.
 *
 * A kit's bill of materials is a recipe, not a record of something that
 * happened: taking a line off says the kit no longer contains it, and there
 * is no history to preserve. Past orders are unaffected — they were exploded
 * into SKUs when they were placed and never refer back to the kit.
 */
export function removeKitItem(id: number) {
  return del(`/catalog/kit-items/${id}/`)
}
