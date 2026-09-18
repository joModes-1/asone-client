/**
 * Named aliases over the generated schema.
 *
 * Screens import from here, never from `schema.d.ts` directly, so that
 * `components["schemas"]["..."]` noise stays in one file and a rename on the
 * server surfaces as one compile error here instead of fifty in features.
 *
 * Everything below is an alias except the four marked SCHEMA GAP, where the
 * generated types are wrong or too loose to use. Each says what to ask the
 * backend for so it can be deleted.
 */

import type { components } from './schema.d.ts'

type S = components['schemas']

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** DRF's list envelope. 50 rows per page. */
export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * UGX, as the server sends it: a decimal string like "25000.00".
 *
 * Deliberately not `number`. Floating point cannot hold 0.1 exactly, and a
 * rounding error on a price becomes a wrong invoice. Format it with
 * `domain/money`; never do arithmetic on it.
 */
export type Money = string

/** `YYYY-MM-DD`. */
export type IsoDate = string

/** ISO 8601 with a time. */
export type IsoDateTime = string

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export type Role = S['RoleEnum']
export type RoleInfo = S['Role']
export type Scope = S['ScopeEnum']
export type WarehouseSummary = S['WarehouseSummary']
export type SchoolSummary = S['SchoolSummary']
export type UserAdmin = S['UserAdmin']

/**
 * Creating a staff account — the request body for `POST /auth/users/`.
 *
 * SCHEMA GAP — the generated type includes `id` as required, because the
 * server names the same serializer for the request and the 201 response,
 * and `id` is only ever present on the latter. Ask for a request-only
 * serializer (or `@extend_schema(request=...)`) and delete this override.
 */
export type UserCreate = Omit<S['UserCreate'], 'id'>

/**
 * "Get Started Onboarding" — the request body for `POST /auth/register/`.
 *
 * SCHEMA GAP — the same `id` problem as `UserCreate` above, for the same
 * reason: one serializer named for both the request and the 201 response.
 */
export type AccountRequest = Omit<S['RegistrationRequestCreate'], 'id'>

/**
 * What `POST /auth/register/` returns — a pending request, nothing more.
 *
 * No account exists yet and nothing here can be signed into: a lead must
 * approve it first, which is the moment the role is assigned.
 */
export type RegistrationRequest = S['RegistrationRequest']

export type LoginAttempt = S['LoginAttempt']

/**
 * The seven columns of AsOne's access matrix, as returned by `/auth/roles/`
 * and embedded in every user.
 *
 * SCHEMA GAP — the server serialises `User.access` and `Role.functions` as
 * open objects, so the generated types are `{[key: string]: unknown}` and
 * `{[key: string]: boolean}`. This is the field the whole navigation is
 * drawn from, so it needs real keys. Ask for `@extend_schema_field` on both
 * serializer fields and delete this type.
 */
export type AccessFunction =
  | 'table_updates'
  | 'production_orders'
  | 'warehouse_receiving_and_shipping'
  | 'inventory_adjustments'
  | 'school_orders'
  | 'backorder_transfers'
  | 'financial_reports'

export type AccessFunctions = Record<AccessFunction, boolean>

export interface Access {
  scope: Scope
  functions: AccessFunctions
}

/**
 * The signed-in user.
 *
 * SCHEMA GAP — two corrections to the generated `User`:
 *
 *   `access`             typed as an open object upstream (see above).
 *   `warehouse`/`school` declared non-nullable, but both come back `null`
 *                        for Program Lead, Operations Manager and Finance.
 *                        Verified against live logins for all five roles.
 *                        Without this, `user.warehouse.name` type-checks
 *                        and then crashes for three of the five roles.
 *
 * Ask for `allow_null=True` on those two serializer fields and drop the
 * override.
 */
export type CurrentUser = Omit<S['User'], 'access' | 'warehouse' | 'school'> & {
  access: Access
  warehouse: WarehouseSummary | null
  school: SchoolSummary | null
}

export interface Credentials {
  email: string
  password: string
}

/**
 * What step one of signing in returns.
 *
 * A password alone is no longer enough: `POST /auth/login/` checks it, emails
 * a one-time code and hands back this challenge. No tokens are issued here.
 */
export type LoginChallenge = S['LoginChallengeIssued']

/** Step two: the challenge id plus the code from the email. */
export type VerifyLoginCode = S['VerifyLoginCode']

/** A new member of staff confirming the address their account was created against. */
export type EmailVerification = S['EmailVerification']

/**
 * What `POST /auth/login/verify/` returns — the tokens and the whole user,
 * so the app can render without a second round-trip.
 *
 * SCHEMA GAP — the endpoint declares its 200 as `Login`, which is the
 * *request* serializer, so the generated types claim it returns
 * `{email, password}`. Ask for `@extend_schema(responses=...)` naming a
 * response serializer and replace this with the alias.
 */
export interface Session {
  access: string
  refresh: string
  user: CurrentUser
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export type Garment = S['Garment']
export type GarmentPrice = S['GarmentPrice']
export type Sku = S['Sku']
export type Size = S['Size']
export type Kit = S['Kit']
export type KitItem = S['KitItem']
export type School = S['School']
export type Warehouse = S['Warehouse']
export type TailoringCenter = S['TailoringCenter']
export type MinimumStockLevel = S['MinimumStockLevel']
export type PriceListRow = S['PriceListRow']
export type KitPriceListRow = S['KitPriceListRow']
export type UnpriceableKit = S['UnpriceableKit']
export type GroupOrderCosted = S['GroupOrderCosted']
export type ReceiptsByTailoringCenter = S['ReceiptsByTailoringCenter']
export type SchoolLevel = S['SchoolLevelEnum']
export type GarmentSchoolLevel = S['GarmentSchoolLevelEnum']

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export type StockLevel = S['StockLevel']
export type StockMovement = S['StockMovement']
export type MovementType = S['MovementTypeEnum']
export type StockStatus = S['StockStatusEnum']
export type ReasonCode = S['ReasonCode']
export type ReasonDirection = S['DirectionEnum']
export type InventoryAdjustment = S['InventoryAdjustment']
export type WarehouseTransfer = S['WarehouseTransfer']
export type ReorderAlert = S['ReorderAlert']

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------

export type GroupOrder = S['GroupOrder']
export type ProductionOrder = S['ProductionOrder']
export type Receipt = S['Receipt']
export type ProcurementStatus = S['ProcurementOrderStatusEnum']
export type OutstandingRow = S['OutstandingRow']
export type ReconciliationRow = S['ReconciliationRow']

// ---------------------------------------------------------------------------
// Dashboard
//
// A read-only aggregation over the other apps. Totals here are computed by
// the server, so money is read rather than summed on the client.
// ---------------------------------------------------------------------------

export type DashboardSummary = S['DashboardSummary']
export type AttentionAlert = S['AttentionAlert']
export type ActivityEvent = S['ActivityEvent']
export type OrderVolume = S['OrderVolume']
export type OrderVolumeDay = S['OrderVolumeDay']
export type NotificationFeed = S['Notifications']
export type NotificationItem = S['Notification']
export type InventoryByWarehouse = S['InventoryByWarehouse']
export type WarehouseInventory = S['WarehouseInventory']
export type WeeklyReport = S['WeeklyReport']
export type WeeklyReportRow = S['WeeklyReportRow']

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type SchoolOrder = S['SchoolOrder']
export type SchoolOrderLine = S['SchoolOrderLine']
export type SchoolOrderStatus = S['SchoolOrderStatusEnum']
export type Invoice = S['Invoice']
export type OrderAvailabilityRow = S['OrderAvailabilityRow']
export type OrderDemandRow = S['OrderDemandRow']
export type OrderOnHold = S['OrderOnHold']
export type PackingList = S['PackingList']
/** An order picked but not yet despatched — F52/F54, the picking queue. */
export type PartProcessedOrder = S['PartProcessedOrder']

/**
 * One despatch against an order.
 *
 * An order can have more than one: a backorder may be filled by a warehouse
 * that is not the school's own and shipped direct (decision D2). `received_at`
 * is the school confirming it arrived — the fact that completes the order.
 */
export type Shipment = S['Shipment']
/** What a school is still owed after a short pick — F44. */
export type Backorder = S['Backorder']
export type ShipmentLine = S['ShipmentLine']
/** A row of the picking backlog — F38. */
export type PickingQueueRow = S['PickingQueueRow']
export type PickingSummary = S['PickingSummary']
/** A school with orders picked and waiting — the despatch queue. */
export type ReadyToDespatch = S['ReadyToDespatch']

/**
 * What a school's dashboard shows — orders by state, what is owed, parcels
 * awaiting confirmation, and outstanding backorders.
 *
 * A separate shape from `DashboardSummary` because it answers a different
 * question. That one is about a warehouse: units in bins, SKUs under their
 * floor. A school holds no stock, so none of those figures are about it.
 */
export type SchoolDashboard = S['SchoolDashboard']
export type SchoolDelivery = S['DeliveryToConfirm']
export type SchoolBackorder = S['SchoolBackorder']
export type PackingListLine = S['PackingListLine']

// ---------------------------------------------------------------------------
// Organization — the Settings screen
// ---------------------------------------------------------------------------

/**
 * The one settings row. Read by anyone signed in, written by Program Lead
 * and Operations Manager only — see `organization/views.py::SettingsView`.
 */
export type OrgSettings = S['Settings']
export type Timezone = S['TimezoneEnum']
export type Currency = S['CurrencyEnum']
export type DefaultPaperSize = S['DefaultPaperSizeEnum']
export type PackingListLayout = S['PackingListLayoutEnum']
