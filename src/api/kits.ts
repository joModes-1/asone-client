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
  /** The cohort a kit is cut for — see `src/domain/kitCohort.ts`. */
  fit_group?: string
  gender?: string
  residence?: string
  size?: number
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
export function kitItems(kitId?: number, page?: { page: number; page_size: number }) {
  return get<Page<KitItem>>('/catalog/kit-items/', {
    ...(kitId ? { kit: kitId } : {}),
    ...(page ?? {}),
  })
}

export interface KitInput {
  /**
   * Left out for a kit that states a cohort — the server composes it from
   * the four fields below and returns `KIT-NUR-B-DAY-XS`. Sent only for a
   * general kit, which has nothing to compose from.
   */
  kit_number?: string
  name: string
  /** Who this kit is for, in a sentence. Shown to schools choosing one. */
  description?: string
  /**
   * "PS" or "HS". A kit is for one level — there is no "both".
   *
   * Omitted whenever a `fit_group` is sent: the server derives the level
   * from the band, and sending both invites the two to disagree.
   */
  school_level?: string
  /** The class band the kit is cut for — "NUR", "P14", "P57", "S14", "S56". */
  fit_group?: string
  /** "B" or "G". */
  gender?: string
  /** "DAY" or "BRD". */
  residence?: string
  /** The size's id. One kit per cohort per size. */
  size?: number | null
  is_active?: boolean
  /**
   * The kit's components, sent with the kit rather than after it.
   *
   * Creating a kit used to be two calls — POST the kit, then POST each
   * line — and those can half-succeed. A kit saved with three of its five
   * components is worse than either outcome: it is in the catalogue, it
   * can be ordered, and it is wrong. Sent here, the server writes the kit
   * and its lines in one transaction.
   *
   * On an update, leaving this out keeps the components as they are; an
   * empty array really does empty the kit.
   */
  items?: { sku: number; quantity: number }[]
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


/**
 * What a kit import did, or would have done.
 *
 * `components_removed` is its own figure, and the screen says it out loud.
 * It is the one thing this import does that the catalogue import never
 * does: for a kit named in the file, the file's components **replace** what
 * the kit holds, so a line dropped from the sheet is dropped from the kit.
 * That is right for a bill of materials — it is a recipe, not a record of
 * something that happened — but nobody should learn it from a diff.
 */
export interface KitImportResult {
  kits: number
  unchanged: number
  components: number
  components_changed: number
  components_removed: number
  dry_run: boolean
  detail: string
}

/**
 * Upload a kit bill of materials — kits and the SKUs in them.
 *
 * **The garment catalogue has to be imported first.** Components are
 * matched to SKUs that already exist, by number; nothing is created here.
 *
 * Multipart, and a rejection comes back as a 400 whose body has `rows` —
 * the same shape as the catalogue import, and for the same reason. See
 * `importCatalogue` in `api/catalog.ts` on why the Content-Type header has
 * to be cleared.
 */
export function importKits(file: File, options: { dryRun: boolean; sheet?: string }) {
  const body = new FormData()
  body.append('file', file)
  body.append('dry_run', String(options.dryRun))
  if (options.sheet) body.append('sheet', options.sheet)

  return post<KitImportResult>('/catalog/kits/import/', body, {
    headers: { 'Content-Type': undefined },
  })
}
