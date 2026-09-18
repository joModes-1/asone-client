/**
 * Catalog — master data.
 *
 * Reads for the shell and dashboard, the Locations screens (tailoring
 * centers, warehouses and schools), and now Inventory & Products —
 * garments, sizes, SKUs and minimum stock levels.
 */

import { get, patch, post } from './http'
import type {
  Garment,
  GarmentPrice,
  GarmentSchoolLevel,
  IsoDate,
  MinimumStockLevel,
  KitPriceListRow,
  PriceListRow,
  UnpriceableKit,
  Page,
  School,
  SchoolLevel,
  Size,
  Sku,
  TailoringCenter,
  Warehouse,
} from './types'

// ---------------------------------------------------------------------------
// Locations — Tailoring Centers, Warehouses, Schools
// ---------------------------------------------------------------------------
//
// Three tables and two relationships, and the relationships are the part
// worth getting right on screen:
//
//   Warehouse -> primary Tailoring Center   OPTIONAL. p.4: "warehouses have
//                a primary TC but can order on any TC", so it is a default
//                for production orders, not a restriction — and a warehouse
//                can exist before its TC does.
//   School    -> primary Warehouse          REQUIRED. A school orders from
//                one warehouse and no other. A backorder may still be filled
//                by a different warehouse shipping direct (decision D2), but
//                that is a fulfilment decision, not the school's choice.
//
// Writing is the two leads only. Warehouse and school staff may read.
// Nothing here is ever deleted: a site is referenced by every transaction
// that happened there, so `PROTECT` refuses and the API answers 409 naming
// what still points at it.

// Tailoring Centers — F10

export function tailoringCenters(params?: { page?: number }) {
  return get<Page<TailoringCenter>>('/catalog/tailoring-centers/', params ?? undefined)
}

export function tailoringCenter(id: number) {
  return get<TailoringCenter>(`/catalog/tailoring-centers/${id}/`)
}

export interface TailoringCenterInput {
  name: string
  address?: string
}

export function createTailoringCenter(input: TailoringCenterInput) {
  return post<TailoringCenter>('/catalog/tailoring-centers/', input)
}

export function updateTailoringCenter(id: number, input: Partial<TailoringCenterInput>) {
  return patch<TailoringCenter>(`/catalog/tailoring-centers/${id}/`, input)
}

// ---------------------------------------------------------------------------
// Warehouses — F11
// ---------------------------------------------------------------------------

export function warehouses(params?: { primary_tailoring_center?: number; page?: number }) {
  return get<Page<Warehouse>>('/catalog/warehouses/', params ?? undefined)
}

export function warehouse(id: number) {
  return get<Warehouse>(`/catalog/warehouses/${id}/`)
}

export interface WarehouseInput {
  name: string
  address?: string
  // `null`, not just `undefined`, matters here: PATCH omits an absent field
  // (leaves whatever the warehouse already had), but only `null` actually
  // clears it. A form that lets someone unset "no tailoring center yet"
  // needs to send null explicitly, not merely leave the field out.
  primary_tailoring_center?: number | null
}

export function createWarehouse(input: WarehouseInput) {
  return post<Warehouse>('/catalog/warehouses/', input)
}

export function updateWarehouse(id: number, input: Partial<WarehouseInput>) {
  return patch<Warehouse>(`/catalog/warehouses/${id}/`, input)
}

// ---------------------------------------------------------------------------
// Schools — F12. Also what the order list's school filter uses.
// ---------------------------------------------------------------------------

export function schools(params?: {
  level?: SchoolLevel
  primary_warehouse?: number
  is_active?: boolean
  page?: number
}) {
  return get<Page<School>>('/catalog/schools/', params ?? undefined)
}

export function school(id: number) {
  return get<School>(`/catalog/schools/${id}/`)
}

export interface SchoolInput {
  name: string
  level: SchoolLevel
  address?: string
  primary_warehouse: number
  is_active?: boolean
  /**
   * Students enrolled, or null where nobody has said.
   *
   * Null rather than 0 on purpose: a school with no students and a school
   * nobody has counted are different facts, and averaging the second as zero
   * would understate what to order for it.
   */
  student_count?: number | null
}

export function createSchool(input: SchoolInput) {
  return post<School>('/catalog/schools/', input)
}

/** Schools cannot be deleted — PATCH is the only way to change one. */
export function updateSchool(id: number, input: Partial<SchoolInput>) {
  return patch<School>(`/catalog/schools/${id}/`, input)
}

/**
 * SKUs, with the garment each belongs to.
 *
 * The reports screen needs the garment to group stock by category: stock
 * levels identify a SKU by number and description but carry no garment id,
 * so the two are joined on the client.
 */
export function skus(params?: {
  garment?: number
  size?: number
  garment__school_level?: GarmentSchoolLevel
  is_active?: boolean
  page?: number
  /** Capped at 200 by the server's pagination class. */
  page_size?: number
}) {
  return get<Page<Sku>>('/catalog/skus/', params ?? undefined)
}

export interface SkuInput {
  garment: number
  size: number
  /** Filled in from the garment and size on the server if left blank. */
  description?: string
  is_active?: boolean
}

export function createSku(input: SkuInput) {
  return post<Sku>('/catalog/skus/', input)
}

/**
 * Edit a SKU.
 *
 * Neither `garment` nor `size` is changeable: a SKU *is* one garment in one
 * size, and its number is composed from the pair and printed on pick lists
 * and packing lists. Changing either would silently make an existing number
 * mean a different product. A SKU built on the wrong garment is deactivated
 * and the right one created.
 */
export type SkuPatch = Pick<SkuInput, 'description' | 'is_active'>

export function updateSku(id: number, input: SkuPatch) {
  return patch<Sku>(`/catalog/skus/${id}/`, input)
}

// ---------------------------------------------------------------------------
// Garments and sizes — what a SKU is made of.
// ---------------------------------------------------------------------------

export function garments(params?: {
  school_level?: GarmentSchoolLevel
  is_active?: boolean
  page?: number
  page_size?: number
}) {
  return get<Page<Garment>>('/catalog/garments/', params ?? undefined)
}

/**
 * Add a garment — the thing a SKU is one size of.
 *
 * `code` is not a field: the server derives it from the name and freezes it,
 * because every SKU beneath the garment is numbered from it and those
 * numbers are printed on pick lists.
 *
 * Leads only (F05), which is narrower than SKUs.
 */
export interface GarmentInput {
  name: string
  school_level: GarmentSchoolLevel
  colour?: string
  /**
   * The swatch, as "#RRGGBB".
   *
   * Stored rather than derived from the name, because deriving means the app
   * can only draw colours it has been taught — a purple or a mustard had no
   * dot, or worse, one that claimed to be a colour it was not.
   */
  colour_hex?: string
  is_active?: boolean
}

export function createGarment(input: GarmentInput) {
  return post<Garment>('/catalog/garments/', input)
}

export function updateGarment(id: number, input: Partial<GarmentInput>) {
  return patch<Garment>(`/catalog/garments/${id}/`, input)
}

/**
 * Set a garment's price from a date — the only sanctioned way to change one.
 *
 * It does not overwrite. The current price is *closed* on `active_from` and
 * a new period opened, because a price is a number that applied over a
 * period rather than a number on a product: an invoice raised in March has
 * to reprint at March's price however many times it changes afterwards.
 *
 * Both writes happen in one transaction on the server, so a garment is never
 * left with its old price closed and no new one open.
 */
export interface RepriceInput {
  unit_price: string
  /** First day the new price applies. The current one is closed on it. */
  active_from: IsoDate
}

export function reprice(garmentId: number, input: RepriceInput) {
  return post<GarmentPrice>(`/catalog/garments/${garmentId}/reprice/`, input)
}

/** Every price this garment has had, newest first. */
export function garmentPrices(garmentId: number) {
  return get<GarmentPrice[]>(`/catalog/garments/${garmentId}/prices/`)
}

/**
 * Add a size.
 *
 * `sort_order` exists because sizes do not sort as text — "10" sorts before
 * "8" — and pick lists and price lists read in size order. Smallest first.
 */
export interface SizeInput {
  name: string
  sort_order: number
}

export function createSize(input: SizeInput) {
  return post<Size>('/catalog/sizes/', input)
}

export function updateSize(id: number, input: Partial<SizeInput>) {
  return patch<Size>(`/catalog/sizes/${id}/`, input)
}

export function sizes(params?: { page?: number; page_size?: number }) {
  return get<Page<Size>>('/catalog/sizes/', params ?? undefined)
}

// ---------------------------------------------------------------------------
// Minimum stock levels — the reorder floor, one row per SKU per warehouse.
// ---------------------------------------------------------------------------

export function minimumStockLevels(params?: {
  sku?: number
  warehouse?: number
  page?: number
  page_size?: number
}) {
  return get<Page<MinimumStockLevel>>('/catalog/minimum-stock-levels/', params ?? undefined)
}

export interface MinimumStockLevelInput {
  sku: number
  warehouse: number
  minimum_quantity: number
}

export function createMinimumStockLevel(input: MinimumStockLevelInput) {
  return post<MinimumStockLevel>('/catalog/minimum-stock-levels/', input)
}

export function updateMinimumStockLevel(id: number, input: Partial<MinimumStockLevelInput>) {
  return patch<MinimumStockLevel>(`/catalog/minimum-stock-levels/${id}/`, input)
}

/**
 * The price list for one school level on one date — F15, F29, F51.
 *
 * ---------------------------------------------------------------------------
 * Two things about what comes back
 * ---------------------------------------------------------------------------
 * **A garment with no price on that date is omitted, not returned at zero.**
 * A price list is a document a school orders from, and a line reading UGX 0
 * is worse than a line that is not there. Which is exactly why
 * {@link priceGaps} exists: run it before publishing, or a garment silently
 * disappears from what the schools can order and nobody is told.
 *
 * **Garments marked BOTH appear on each list.** They are not a third list.
 *
 * `level` is required for every role except School Staff, who must *not* send
 * it — F29 says a school works from its own list, so the server takes the
 * level from the school on their account and refuses a request for the other
 * one rather than quietly correcting it.
 */
export function priceList(params: { level?: GarmentSchoolLevel; on?: string }) {
  return get<PriceListRow[]>('/catalog/price-lists/', params)
}

/**
 * Active garments with **no price** on a date — the gap report behind a price
 * list.
 *
 * Finance and the leads only. This is the list of things that would vanish
 * from the next published price list, so it is the one report that has to be
 * read before the list is sent out rather than after.
 */
export function priceGaps(params?: { level?: GarmentSchoolLevel; on?: string }) {
  return get<Garment[]>('/catalog/price-lists/gaps/', params ?? undefined)
}

/**
 * The **kit** price list — the other half of F15 and F51.
 *
 * A kit's price is the sum of its components at their price on the date,
 * calculated rather than stored: a kit has no price of its own, and giving it
 * one would let the two disagree the first time a component moved.
 *
 * Same omission rule as garments, with a sharper edge — a kit is left off
 * when **any** component is unpriced, so a catalogue that looks fully priced
 * can still be missing kits. {@link kitPriceGaps} is how that is found.
 */
export function kitPriceList(params: { level?: GarmentSchoolLevel; on?: string }) {
  return get<KitPriceListRow[]>('/catalog/price-lists/kits/', params)
}

/**
 * Kits that cannot be priced, and the components at fault.
 *
 * Each row names the unpriced component garments rather than only the kit,
 * because the cause is almost never the kit itself.
 */
export function kitPriceGaps(params?: { level?: GarmentSchoolLevel; on?: string }) {
  return get<UnpriceableKit[]>('/catalog/price-lists/kits/gaps/', params ?? undefined)
}
