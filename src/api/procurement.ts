/**
 * Procurement — production orders and the receipts against them.
 *
 * The receiving flow (F19, F20, F21) is **three calls, deliberately**, and
 * the screen has to keep them in that order:
 *
 *   outstandingOnOrder   what the order still expects, per SKU. The
 *                        "Expected" column, and the rows the clerk counts
 *                        against.
 *   createReceipt        records what actually arrived. **Does not touch
 *                        stock.**
 *   postReceipt          F21 — writes the ledger rows and raises stock.
 *                        Once only, and there is no way back: the ledger is
 *                        append-only, so a miscount is corrected with an
 *                        inventory adjustment, not by re-posting.
 *
 * Entering and posting are separate because AsOne's flow (p.5) has the
 * warehouse check the delivery against the Tailoring Center's handwritten
 * packing list and resolve differences *before* anything is committed. That
 * gap is the whole reason the compare step exists.
 */

import { get, patch, post } from './http'
import type {
  GroupOrder,
  GroupOrderCosted,
  ReconciliationRow,
  ReceiptsByTailoringCenter,
  OutstandingRow,
  Page,
  ProductionOrder,
  Receipt,
} from './types'

// ---------------------------------------------------------------------------
// Group orders
//
// The consolidated seasonal requirement across all three Tailoring Centers —
// AsOne's p.2: "used to initially fund the TCs". Production orders are the
// breakdown of it, which is why the interesting endpoint here is not the list
// but `groupOrderReconciliation`.
// ---------------------------------------------------------------------------

export function groupOrders(params?: {
  status?: string
  order_date?: string
  page?: number
  page_size?: number
}) {
  return get<Page<GroupOrder>>('/procurement/group-orders/', params ?? undefined)
}

export function groupOrder(id: number) {
  return get<GroupOrder>(`/procurement/group-orders/${id}/`)
}

export interface GroupOrderLineInput {
  sku: number
  quantity: number
}

export interface GroupOrderInput {
  order_date: string
  due_in_warehouse_date?: string | null
  notes?: string
  lines: GroupOrderLineInput[]
}

/**
 * Raise a group order — header and lines in one request, one transaction.
 *
 * **No `unit_price`**, unlike a production order. A production order records
 * what was *negotiated* with a centre, so a typed price is kept; a group
 * order is the requirement, priced from the list in force on `order_date`.
 * There is nothing to negotiate with yet — the centres have not been asked.
 *
 * A garment with no price covering that date refuses the whole request, and
 * the message names the garment. Surface it as-is: "could not create" tells
 * the reader nothing they can act on.
 */
export function createGroupOrder(body: GroupOrderInput) {
  return post<GroupOrder>('/procurement/group-orders/', body)
}

export interface GroupOrderAmendment {
  status?: 'OPEN' | 'CLOSED' | 'CANCELLED'
  due_in_warehouse_date?: string | null
  notes?: string
}

export function amendGroupOrder(id: number, body: GroupOrderAmendment) {
  return patch<GroupOrder>(`/procurement/group-orders/${id}/`, body)
}

/**
 * Requested against ordered, per SKU — the control AsOne asked for.
 *
 * Their spec says production orders "should initially sum up to the Group
 * Order". This is that sum: `requested` from the group order, `ordered`
 * across every production order breaking it down, and the difference.
 *
 * **Negative means the centres have been asked for less than the
 * requirement** — the case worth chasing. Cancelled production orders are
 * excluded server-side, so a withdrawn order does not quietly flatter the
 * comparison.
 *
 * **A bare array, not a page.** The generated schema says
 * `PaginatedReconciliationRowList` and that is wrong: the action returns
 * `Response(serializer(rows, many=True).data)` with no paginator, which is
 * right for a comparison table that has to be read whole. Typed from the
 * live response rather than from `schema.d.ts` — reading `.results` off it
 * yields `undefined`, and the screen renders an empty table with no error.
 */
export function groupOrderReconciliation(id: number) {
  return get<ReconciliationRow[]>(`/procurement/group-orders/${id}/reconciliation/`)
}

/**
 * Production orders still awaiting delivery, for this user's warehouse.
 *
 * Already scoped by the server: a Namayemba clerk cannot receive against
 * Serere's orders, so there is no warehouse parameter to pass.
 */
export function openProductionOrders() {
  return get<ProductionOrder[]>('/procurement/production-orders/open/')
}

/**
 * Ordered minus received, per SKU — the Expected column.
 *
 * Counts **posted** receipts only. An unposted receipt is paperwork somebody
 * is still checking, not goods the warehouse can rely on, so a part-received
 * order shows what is genuinely still outstanding.
 */
export function outstandingOnOrder(productionOrderId: number) {
  return get<OutstandingRow[]>(
    `/procurement/production-orders/${productionOrderId}/outstanding/`,
  )
}

/**
 * Production orders, newest first.
 *
 * Scoped by the server: warehouse staff see their own site's orders, the
 * leads and Finance see every site.
 */
export function productionOrders(params?: {
  status?: string
  tailoring_center?: number
  warehouse?: number
  page?: number
  page_size?: number
}) {
  return get<Page<ProductionOrder>>('/procurement/production-orders/', params ?? undefined)
}

export function productionOrder(id: number) {
  return get<ProductionOrder>(`/procurement/production-orders/${id}/`)
}

export interface ProductionOrderLineInput {
  sku: number
  quantity: number
  /**
   * What was agreed with the Tailoring Center.
   *
   * Omit it and the garment's price on the order date is copied onto the
   * line and fixed there. AsOne negotiates these, so a supplied price is
   * recorded rather than overruled — but a SKU with no price on that date
   * and no price given is a 400, not a zero.
   */
  unit_price?: string
}

export interface ProductionOrderInput {
  tailoring_center: number
  warehouse: number
  order_date: string
  due_in_warehouse_date?: string | null
  group_order?: number | null
  notes?: string
  lines: ProductionOrderLineInput[]
}

/**
 * Raise a production order on a Tailoring Center — F17.
 *
 * Header and lines in one request, written in one transaction. A warehouse
 * may order from **any** TC, not only its primary one (p.4), so the centre is
 * chosen per order rather than derived.
 *
 * `group_order` is optional: the first season's orders break down a group
 * order, reorders later in the year have none.
 */
/**
 * Amend a production order's header — F18.
 *
 * Header fields only: lines are not editable, and the server rejects an
 * attempt rather than half-accepting it.
 *
 * Cancelling is a status change, never a delete — the document funds a
 * Tailoring Centre and has to survive being withdrawn. The server refuses to
 * cancel an order goods have already arrived against, because receipts point
 * at it and carry the value the ledger was written from; close it instead.
 */
export interface ProductionOrderAmendment {
  status?: 'OPEN' | 'CLOSED' | 'CANCELLED'
  due_in_warehouse_date?: string | null
  notes?: string
  /**
   * The group order this breaks down. `null` detaches it.
   *
   * Amendable because the create form did not always ask for it, so orders
   * exist that break down a group order without saying so — and the
   * requirement then reads as wholly unmet. Cancelling and re-raising is
   * not a fair repair for a document that funds a Tailoring Center.
   */
  group_order?: number | null
}

export function amendProductionOrder(id: number, body: ProductionOrderAmendment) {
  return patch<ProductionOrder>(`/procurement/production-orders/${id}/`, body)
}

export function createProductionOrder(body: ProductionOrderInput) {
  return post<ProductionOrder>('/procurement/production-orders/', body)
}

export function receipts(params?: { production_order?: number; page?: number }) {
  return get<Page<Receipt>>('/procurement/receipts/', params ?? undefined)
}

export function receipt(id: number) {
  return get<Receipt>(`/procurement/receipts/${id}/`)
}

export interface ReceiptLineInput {
  sku: number
  /** What was counted off the van. The server refuses zero — omit the line. */
  quantity_received: number
  /** What the paper claimed. Omitted is "the paper did not say". */
  quantity_on_packing_list?: number
  discrepancy_note?: string
}

export interface ReceiptInput {
  production_order: number
  packing_list_number: string
  carrier_name?: string
  date_received: string
  notes?: string
  lines: ReceiptLineInput[]
}

/** Record what arrived. Stock is unchanged until {@link postReceipt}. */
export function createReceipt(body: ReceiptInput) {
  return post<Receipt>('/procurement/receipts/', body)
}

/**
 * F21 — post to inventory. Raises stock, once and permanently.
 *
 * Each ledger row is valued at the price on the production order line, not
 * today's price list: the stock is worth what was paid for it.
 */
export function postReceipt(id: number) {
  return post<Receipt>(`/procurement/receipts/${id}/post_to_inventory/`, {})
}

/**
 * Group orders, costed — F55.
 *
 * What AsOne committed to the Tailoring Centres over a period, at the price
 * agreed on the day rather than today's price list. `totals` is the single
 * figure Finance usually wants; `orders` is the working behind it.
 *
 * Cancelled orders are excluded by default. A withdrawn commitment is not a
 * cost, and including it by default would overstate every period it appears
 * in — but it is available, because "what did we cancel" is a real question.
 */
export interface GroupOrdersCostedReport {
  totals: { orders: number; quantity: number; value: string }
  orders: GroupOrderCosted[]
}

export function groupOrdersCosted(params?: {
  from?: string
  to?: string
  include_cancelled?: boolean
}) {
  return get<GroupOrdersCostedReport>(
    '/procurement/reports/group-orders-costed/',
    params ?? undefined,
  )
}

/**
 * Receipts from Tailoring Centres, costed — F56.
 *
 * What each centre actually delivered and what it was worth — **counted**,
 * not what the order asked for or the packing list claimed. A short delivery
 * is worth less, and this is the report that shows it.
 */
export interface ReceiptsCostedReport {
  by_tailoring_center: ReceiptsByTailoringCenter[]
}

export function receiptsCosted(params?: {
  from?: string
  to?: string
  tailoring_center?: number
  warehouse?: number
}) {
  return get<ReceiptsCostedReport>(
    '/procurement/reports/receipts-costed/',
    params ?? undefined,
  )
}
