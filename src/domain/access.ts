/**
 * Who may see what.
 *
 * Pure predicates over a user. No fetching, no components — so a test can
 * assert the whole navigation model without rendering anything.
 *
 * Two things this deliberately does not do:
 *
 *   It does not name roles. AsOne's access matrix is served by the backend
 *   as seven boolean columns per role; asking `can(user, 'school_orders')`
 *   means a change to one cell of that matrix stays a backend change. A
 *   frontend that branches on `role === 'FINANCE'` has copied the matrix,
 *   and the copy goes stale silently.
 *
 *   It does not decide which *rows* a user sees. That is `scope_to_user_site`
 *   on the server, it is invisible from here, and a warehouse clerk's list
 *   request simply comes back containing their own site only. Never filter a
 *   scoped list client-side, and never read an empty list as an error — it
 *   may be a correct, scoped, empty answer.
 *
 * All of this is advisory. Hiding a control is cosmetic; the server re-checks
 * every request, so a 403 is always possible and must still be handled.
 */

import type { IdentityTone } from '@/components'
import type { AccessFunction, CurrentUser, Role, Scope } from '@/api/types'

/** Does this user hold this column of the access matrix? */
export function can(user: CurrentUser | null, fn: AccessFunction): boolean {
  return user?.access.functions[fn] === true
}

/** Does this user hold at least one of these columns? */
export function canAny(user: CurrentUser | null, fns: readonly AccessFunction[]): boolean {
  return fns.some((fn) => can(user, fn))
}

export function scopeOf(user: CurrentUser | null): Scope | null {
  return user?.access.scope ?? null
}

/** All locations, rather than a single assigned site. */
export function seesAllLocations(user: CurrentUser | null): boolean {
  return scopeOf(user) === 'all_locations'
}

/**
 * The one warehouse this user is tied to, or null for an all-locations role.
 *
 * Useful for defaulting a warehouse picker; not for filtering, which the
 * server has already done.
 */
export function homeWarehouseId(user: CurrentUser | null): number | null {
  return user?.warehouse?.id ?? null
}

/** The one school this user is tied to, or null. */
export function homeSchoolId(user: CurrentUser | null): number | null {
  return user?.school?.id ?? null
}

/**
 * Where this user belongs, for showing next to their name. Null for an
 * all-locations role, which is a real answer and not missing data.
 */
export function siteLabel(user: CurrentUser | null): string | null {
  return user?.warehouse?.name ?? user?.school?.name ?? null
}

/**
 * Who may read the school order list.
 *
 * ---------------------------------------------------------------------------
 * Not a matrix column, and deliberately not pretending to be one
 * ---------------------------------------------------------------------------
 * `SchoolOrderViewSet` splits read from write: writing is School Staff only
 * (the "School Orders Entry" column), while reading is granted per view
 * through `read_roles`. The readable set is School Staff, Finance and both
 * leads — a rule with no single column behind it.
 *
 * Operations Manager sits alongside Program Lead because every other cell of
 * AsOne's matrix treats the two identically.
 *
 * NOTE: this is wider than AsOne's printed matrix (p.9), which leaves the
 * leads' cell blank. Widened at ERA 92's request on 9 September 2026, with
 * the server and its tests changed to match — and it still needs AsOne's
 * written confirmation. If they say no, drop the two leads here and narrow
 * `read_roles` in orders/views.py back to Finance.
 *
 * Expressing that as some column that happens to fit — `inventory_adjustments`
 * is Finance-only, so it would work — would be a lie that survives until
 * somebody changes that cell for an unrelated reason. A named predicate that
 * says which server rule it mirrors is honest about what it is.
 *
 * Keep this in step with `orders/views.py::SchoolOrderViewSet.read_roles`.
 */
export function canReadSchoolOrders(user: CurrentUser | null): boolean {
  if (!user) return false
  return (
    user.role === 'SCHOOL_STAFF' ||
    user.role === 'FINANCE' ||
    user.role === 'PROGRAM_LEAD' ||
    user.role === 'OPERATIONS_MANAGER'
  )
}

/**
 * Who may receive goods in and send them out — F19-F21, F37-F42.
 *
 * The "Warehouse Receiving and Shipping" column: warehouse staff for their
 * own site, and the two leads everywhere. `scope_to_user_site` on the server
 * confines a clerk to their warehouse; this only decides who sees the door.
 *
 * Mirrors `accounts/permissions.py::CanReceiveAndShip`.
 */
export function canReceiveAndShip(user: CurrentUser | null): boolean {
  return can(user, 'warehouse_receiving_and_shipping')
}

/**
 * Who may raise a production order on a Tailoring Center — F17.
 *
 * The **Table Updates** column, which AsOne gives to the two leads alone.
 * Warehouse staff and Finance read the queue — a clerk receives against it —
 * but neither may create one: what to ask a TC to make is a programme
 * decision, not a warehouse one.
 *
 * Mirrors the write half of `accounts/permissions.py::MasterDataAccess`,
 * which is why this is `can(user, 'table_updates')` and not a role check.
 */
export function canRaiseProductionOrder(user: CurrentUser | null): boolean {
  return can(user, 'table_updates')
}

/**
 * Who may edit the Settings screen — organization name, defaults, alert
 * toggles. Same "Table Updates" column as every other piece of master data;
 * everyone signed in can still read the screen, since timezone and currency
 * are needed to render the app consistently regardless of role.
 */
export function canEditOrgSettings(user: CurrentUser | null): boolean {
  return can(user, 'table_updates')
}

/**
 * Who may place, amend or cancel a school order — F30-F33, F36.
 *
 * **School Staff, and nobody else.** AsOne's p.9 matrix leaves the School
 * Orders Entry column blank for both leads and for Finance, and the Role
 * Access sheet keeps the point of sale off their screens. Finance and the
 * leads *read* orders — see `canReadSchoolOrders` — they do not write them.
 *
 * Mirrors `orders/permissions.py::SchoolOrderAccess`, write half.
 *
 * Open question Q7 asks whether every school has a working computer. If the
 * answer is no, somebody enters orders on their behalf and their role joins
 * this predicate — which is why it is a predicate and not an inline check.
 */
export function canPlaceSchoolOrder(user: CurrentUser | null): boolean {
  return user?.role === 'SCHOOL_STAFF'
}

/**
 * Who may confirm a parcel arrived — the second half of F41.
 *
 * The school holding it. Separate from {@link canPlaceSchoolOrder} even
 * though the audience matches today, because it is a different act — the
 * school reports a fact about the document rather than changing it — and it
 * is the likeliest to move if Q7 is answered badly.
 *
 * Mirrors `orders/permissions.py::CanConfirmReceipt`.
 */
export function canConfirmReceipt(user: CurrentUser | null): boolean {
  return user?.role === 'SCHOOL_STAFF'
}

/**
 * Who may release an order off Hold — F35.
 *
 * **Finance, and that is a placeholder.** AsOne's chart says an order waits
 * until "School Monitor" confirms the invoice is paid, and nobody has said
 * what School Monitor is — open question Q2. The server codes it as Finance
 * on the reasoning that confirming money has arrived is a finance act, and
 * says plainly that this is its reading rather than AsOne's instruction.
 *
 * Deliberately not School Staff: a school marking its own invoice paid is a
 * control decision AsOne has not made.
 *
 * Mirrors `orders/permissions.py::CanConfirmPayment`. When Q2 is answered,
 * both change together.
 */
export function canConfirmPayment(user: CurrentUser | null): boolean {
  return user?.role === 'FINANCE'
}

/**
 * Who may read a packing list — F40.
 *
 * The leads and the warehouse that packs it. AsOne's checklist leaves the
 * School Staff cell blank, and the server enforces that
 * (`CanReadPackingList`), so a school clerk's Print button is disabled with
 * the reason rather than left to fail on a 403.
 *
 * Worth querying with AsOne: their definitions page says a school uses the
 * invoice number and student name to hand shipments to the right child,
 * which is what a packing list is for. The server's reading — and so this
 * one — is that the school gets the printed sheet in the box, not a screen.
 */
export function canReadPackingList(user: CurrentUser | null): boolean {
  if (!user) return false
  return (
    user.role === 'PROGRAM_LEAD' ||
    user.role === 'OPERATIONS_MANAGER' ||
    user.role === 'WAREHOUSE_STAFF'
  )
}

/**
 * Who has a warehouse dashboard — and so a notification bell.
 *
 * The split is on **scope, not role name**, the same line
 * {@link seesWarehouseDashboard}'s caller `HomeScreen` already drew: a role
 * scoped to schools gets the school screen, everybody else the warehouse
 * one. Mirrors `dashboard/views.py::CanSeeWarehouseDashboard`, which refuses
 * School Staff outright.
 *
 * This decides the bell as well as the screen because the bell reads
 * `/dashboard/notifications/`, which sits behind that same permission. A
 * school clerk was shown a bell that answered 403 on every poll and rendered
 * "none unread" — a control that reported all clear while it was in fact
 * forbidden. There is no school-side alert feed to point it at: the school
 * dashboard returns counts, not graded conditions. If AsOne wants one, it is
 * a new endpoint, and this predicate is where the bell would learn about it.
 */
export function seesWarehouseDashboard(user: CurrentUser | null): boolean {
  return scopeOf(user) !== 'assigned_schools'
}

/**
 * Who may post an inventory adjustment — F23, F24, F26, F27.
 *
 * The **Inventory Adjustments** column, which AsOne's matrix gives to Finance
 * alone. Not the leads, and not the warehouse that did the counting — open
 * question Q3 asks whether that separation is intended, and until it is
 * answered the code follows the matrix.
 *
 * Named rather than inlined because it is now asked in two places: the
 * sidebar entry, and the tab on Warehouse Transfers that leads here. Transfers
 * are a wider audience — both leads *and* Finance — so a lead reaching the
 * transfers screen was offered a tab to a screen they are refused.
 *
 * Mirrors `accounts/permissions.py`'s `inventory_adjustments` column.
 */
export function canPostAdjustments(user: CurrentUser | null): boolean {
  return can(user, 'inventory_adjustments')
}

/**
 * True while the account is held at the password gate.
 *
 * The backend answers 403 on almost everything in this state — only
 * `/auth/me/`, `/auth/password/change/` and `/auth/logout/` are reachable.
 * A wall of 403s on a first sign-in is this flag, not broken permissions.
 */
export function mustChangePassword(user: CurrentUser | null): boolean {
  return user?.must_change_password === true
}

/**
 * A colour per role, so a table of them can be read at a glance.
 *
 * Every role badge used to be the same blue, which made the Role column a
 * column of identically-shaped blue shapes — the one thing it exists to
 * distinguish was the thing it did not.
 *
 * Drawn from the identity colours rather than the semantic ones. Green means
 * confirmed and red means wrong; a role is neither, and a Finance badge in
 * red would read as a problem with the person rather than as their job.
 *
 * Grouped by what the role *is*, so the colours are learnable rather than
 * arbitrary: the two all-locations leads share the authority colour, the two
 * site-bound staff roles are the two site colours, and Finance stands alone
 * because it is the only role that touches value.
 */
const ROLE_TONES: Record<Role, IdentityTone> = {
  PROGRAM_LEAD: 'purple',
  OPERATIONS_MANAGER: 'purple',
  FINANCE: 'amber',
  WAREHOUSE_STAFF: 'teal',
  SCHOOL_STAFF: 'rose',
}

export function roleTone(role: Role | null | undefined): IdentityTone | 'neutral' {
  return (role && ROLE_TONES[role]) || 'neutral'
}

/**
 * The three fields a name or an avatar is drawn from.
 *
 * Structural rather than `CurrentUser`, because both of these are equally
 * true of a `UserAdmin` — the shape the users list and the profile screen
 * hold — and asking for the whole signed-in user meant those screens
 * rewriting the same two lines by hand.
 */
export interface Named {
  email: string
  first_name?: string
  last_name?: string
}

export function fullName(user: Named | null): string {
  if (!user) return ''
  const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return name || user.email
}

/** Initials for an avatar, falling back to the email's first letter. */
export function initials(user: Named | null): string {
  if (!user) return ''
  const first = user.first_name?.[0] ?? ''
  const last = user.last_name?.[0] ?? ''
  const both = `${first}${last}`.toUpperCase()
  return both || (user.email[0]?.toUpperCase() ?? '')
}

/**
 * Who may move stock between warehouses — F25.
 *
 * ---------------------------------------------------------------------------
 * Not a matrix column either, and easy to confuse with two that are
 * ---------------------------------------------------------------------------
 *
 *   Inventory Adj (Finance only)     corrections, returns, damages
 *   F25 (both leads and Finance)     stock moving between warehouses
 *   Backorder Transfers (+ clerks)   a warehouse fills another's shortfall
 *                                    and ships DIRECT to the school
 *
 * The middle one is what this is. AsOne's checklist gives F25 to Program
 * Lead, Operations Manager and Finance — wider than the Inventory Adj column
 * it would otherwise fall under, and narrower than Backorder Transfers, which
 * decision D5 extended to warehouse staff.
 *
 * Warehouse staff are excluded because a transfer commits two sites and a
 * clerk can only see one of them.
 *
 * Gating the transfer screens on `inventory_adjustments` would have been one
 * word shorter and would have denied both leads a feature the matrix grants
 * them.
 *
 * Mirrors `accounts/permissions.py::CanMoveStockBetweenWarehouses`.
 */
export function canMoveStockBetweenWarehouses(user: CurrentUser | null): boolean {
  if (!user) return false
  return (
    user.role === 'PROGRAM_LEAD' ||
    user.role === 'OPERATIONS_MANAGER' ||
    user.role === 'FINANCE'
  )
}

/**
 * Who may read the uniform kit catalogue — F07.
 *
 * School Staff and Finance, plus both leads. Not warehouse staff, and that is
 * the interesting part: a kit is a way of *ordering*, and F33 turns it into
 * component SKUs the moment an order is placed. A warehouse never picks,
 * packs or counts a kit, so it has nothing to read here.
 *
 * The design draws "Uniform Kits" in a sidebar footed "Warehouse Lead", but
 * that is not one of AsOne's five roles — the same placeholder the dashboard
 * frame uses. Taken as a mock-up caption rather than an access decision.
 *
 * Mirrors `catalog/views.py::KitViewSet.read_roles`.
 */
export function canReadKits(user: CurrentUser | null): boolean {
  if (!user) return false
  return (
    user.role === 'SCHOOL_STAFF' ||
    user.role === 'FINANCE' ||
    user.role === 'PROGRAM_LEAD' ||
    user.role === 'OPERATIONS_MANAGER'
  )
}

/**
 * Who may read the stock ledger — F48, the audit trail.
 *
 * Warehouse Staff and Finance, plus both leads. **Not School Staff**, which
 * is the only interesting part: a school reads stock levels at the warehouse
 * that serves it, but the ledger behind those levels is every movement at
 * every site the reader may see, including other schools' picks and
 * shipments. AsOne's matrix does not give them that, and the server does not
 * either.
 *
 * Without this the Stock History entry was `requires: null` — visible to all
 * five roles, and a guaranteed 403 for one of them. The same mistake the
 * notification bell had, and the reason both are predicates now.
 *
 * Mirrors `inventory/views.py::StockMovementViewSet.read_roles` together with
 * `MasterDataAccess`, which adds the two leads to whatever a viewset names.
 */
export function canReadStockHistory(user: CurrentUser | null): boolean {
  if (!user) return false
  return (
    user.role === 'WAREHOUSE_STAFF' ||
    user.role === 'FINANCE' ||
    user.role === 'PROGRAM_LEAD' ||
    user.role === 'OPERATIONS_MANAGER'
  )
}

/**
 * Who may read prices — F04.
 *
 * The same set as kits, and for a different reason: a school sees the price
 * list it orders from, Finance reads costed reports, and the leads set the
 * prices. A warehouse clerk picks garments and never quotes one, so the
 * matrix gives them no price access at all.
 *
 * `requires: null` on the Pricing nav entry put it in a warehouse clerk's
 * sidebar and led them to a guaranteed 403.
 *
 * Mirrors `catalog/views.py::GarmentPriceViewSet.read_roles`.
 */
export function canReadPrices(user: CurrentUser | null): boolean {
  return canReadKits(user)
}
