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
  GarmentSchoolLevel,
  MinimumStockLevel,
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
