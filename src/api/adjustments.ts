/**
 * Inventory adjustments and warehouse transfers — F23 to F27.
 *
 * Two resources that the design draws as one screen, kept apart here because
 * the server keeps them apart: an adjustment writes **one** ledger row and is
 * Finance only; a transfer writes **two**, one out and one in at the same
 * unit value, and both leads may raise it.
 *
 * Both are written in two steps — create, then post. Creating records the
 * intent and touches no stock; posting is the irreversible half. That split
 * exists so a correction can be checked against the shelf before it becomes
 * a permanent row, and the screens keep it visible rather than collapsing it
 * into one button that silently does both.
 */

import { get, patch, post } from './http'
import type {
  InventoryAdjustment,
  IsoDate,
  Page,
  ReasonCode,
  WarehouseTransfer,
} from './types'

// ---------------------------------------------------------------------------
// Reason codes — F13
// ---------------------------------------------------------------------------

/**
 * The lookup table Central Office maintains.
 *
 * Read on every adjustment screen, not just the form: an adjustment carries
 * its code but not that code's direction, so the table is what says whether
 * a quantity of 5 means five more or five fewer.
 */
export function reasonCodes(params?: { is_active?: boolean }) {
  return get<Page<ReasonCode>>('/inventory/reason-codes/', params ?? undefined)
}

/**
 * Add a reason code — F13.
 *
 * `direction` is the load-bearing field: it decides whether posting against
 * this code adds to stock or takes away, so the person posting an adjustment
 * never chooses a sign. Getting it wrong on a new code means every adjustment
 * made against it moves stock the wrong way.
 */
export interface ReasonCodeInput {
  code: string
  name: string
  description?: string
  direction: 'INCREASE' | 'DECREASE'
}

export function createReasonCode(input: ReasonCodeInput) {
  return post<ReasonCode>('/inventory/reason-codes/', input)
}

/**
 * Amend a code, or retire it with `is_active: false`.
 *
 * **There is no delete, by design.** Past adjustments point at the code, and
 * an audit trail that cannot say why a movement happened is not an audit
 * trail. Retiring keeps it on every adjustment already posted while removing
 * it from the choices for new ones.
 *
 * `direction` is deliberately not amendable here even though the server would
 * take it: flipping the direction of a code already used would silently
 * reverse the meaning of every adjustment posted against it. A code pointing
 * the wrong way is retired and replaced.
 */
export function updateReasonCode(
  id: number,
  input: Partial<Omit<ReasonCodeInput, 'direction'>> & { is_active?: boolean },
) {
  return patch<ReasonCode>(`/inventory/reason-codes/${id}/`, input)
}

// ---------------------------------------------------------------------------
// Adjustments — F23, F24, F26, F27
// ---------------------------------------------------------------------------

export type AdjustmentFilters = {
  warehouse?: number | null
  sku?: number
  reason_code?: number
  /** True for what has been committed, false for drafts that moved nothing. */
  posted?: boolean
  /** Inclusive, on `adjustment_date`. Either bound may stand alone. */
  date_from?: IsoDate
  date_to?: IsoDate
  page?: number
  page_size?: number
}

export function adjustments(params?: AdjustmentFilters) {
  return get<Page<InventoryAdjustment>>('/inventory/adjustments/', params ?? undefined)
}

export interface AdjustmentInput {
  warehouse: number
  sku: number
  /** A magnitude. The reason code decides the sign. */
  quantity: number
  reason_code: number
  adjustment_date: IsoDate
  notes?: string
}

/** Writes the adjustment down. Does **not** move stock. */
export function createAdjustment(input: AdjustmentInput) {
  return post<InventoryAdjustment>('/inventory/adjustments/', input)
}

/** The irreversible half: one permanent ledger row. Can only be done once. */
export function postAdjustment(id: number) {
  return post<InventoryAdjustment>(`/inventory/adjustments/${id}/post-to-ledger/`)
}

export interface CountCorrectionInput {
  warehouse: number
  sku: number
  /** What was actually found on the shelf. */
  counted_quantity: number
  adjustment_date: IsoDate
  notes?: string
}

/**
 * Physical count correction — F24.
 *
 * Unlike everything else here this posts immediately when the count differs;
 * there is no draft to check, because the figure it is checked against is the
 * one the server just read. Returns the adjustment it posted, or one with no
 * id where the count matched exactly and nothing was written.
 */
export function correctCount(input: CountCorrectionInput) {
  return post<InventoryAdjustment | null>(
    '/inventory/adjustments/correct-count/',
    input,
  )
}

// ---------------------------------------------------------------------------
// Warehouse transfers — F25
// ---------------------------------------------------------------------------

export type TransferFilters = {
  from_warehouse?: number
  to_warehouse?: number
  posted?: boolean
  /** Inclusive, on `transfer_date`. */
  date_from?: IsoDate
  date_to?: IsoDate
  page?: number
  page_size?: number
}

export function transfers(params?: TransferFilters) {
  return get<Page<WarehouseTransfer>>('/inventory/transfers/', params ?? undefined)
}

export interface TransferInput {
  from_warehouse: number
  to_warehouse: number
  transfer_date: IsoDate
  reason_code?: number | null
  notes?: string
  lines: { sku: number; quantity: number }[]
}

/**
 * Prepares a transfer. Refused if the source does not hold what is being
 * moved — and checked again at posting, because stock moves in between.
 */
export function createTransfer(input: TransferInput) {
  return post<WarehouseTransfer>('/inventory/transfers/', input)
}

/**
 * Posts both halves in one transaction. A half-posted transfer would take
 * stock out of one warehouse without putting it in the other, and the goods
 * would simply cease to exist.
 */
export function postTransfer(id: number) {
  return post<WarehouseTransfer>(`/inventory/transfers/${id}/post-to-ledger/`)
}
