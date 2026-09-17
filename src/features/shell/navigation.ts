/**
 * The navigation model.
 *
 * One entry per destination, each declaring which column of AsOne's access
 * matrix it needs. Nothing here branches on a role name, so a change to one
 * cell of that matrix stays a change on the server.
 *
 * ---------------------------------------------------------------------------
 * Why this is a superset, not a copy of the design
 * ---------------------------------------------------------------------------
 * The dashboard frame (Figma 2001:424) draws every item unconditionally, and
 * its user footer reads "Warehouse Lead". Taken literally it belongs to no
 * single role: it contains **Orders**, which is School Staff only, and
 * **Inv. Adjustments**, which the matrix reserves for Finance and denies to
 * both leads. Drawing it as-is would put two guaranteed 403s in a Program
 * Lead's sidebar.
 *
 * So the design is read as the full set of destinations, and each role sees
 * the subset it holds. A Program Lead gets everything here except Orders and
 * Inv. Adjustments; a warehouse clerk gets receiving, shipments, backorders
 * and inventory; a school clerk gets orders and little else.
 *
 * Hiding an item is cosmetic — the server re-checks every request — but a
 * navigation that leads somewhere forbidden is worse than one that is quiet.
 */

import {
  can,
  canMoveStockBetweenWarehouses,
  canReadKits,
  canReadSchoolOrders,
  canReadStockHistory,
} from '@/domain/access'
import type { AccessFunction, CurrentUser } from '@/api/types'

/**
 * What a destination needs.
 *
 *   a column   the usual case — one cell of AsOne's access matrix
 *   a predicate for the few server rules that are not a single column, such
 *              as who may read school orders. It names the rule it mirrors.
 *   null       every signed-in user
 */
export type NavRequirement = AccessFunction | ((user: CurrentUser | null) => boolean) | null

export interface NavItem {
  label: string
  path: string
  /** Which matrix column this needs, or null for everyone. */
  requires: NavRequirement
  /** Lucide icon name, resolved by the sidebar. */
  icon: string
}

export interface NavGroup {
  /** The uppercase section label. Hidden when the group has no visible items. */
  label: string
  items: NavItem[]
}

export const NAVIGATION: readonly NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', requires: null, icon: 'LayoutDashboard' },
      { label: 'Reports', path: '/reports', requires: 'financial_reports', icon: 'FileBarChart' },
    ],
  },
  {
    label: 'Operations',
    items: [
      /*
       * Mirrors the server, which is wider than the matrix column here:
       * writing an order is School Staff only, but reading the list is
       * School Staff plus Finance — see canReadSchoolOrders. Gating on
       * `school_orders` alone hid the screen from Finance, who the server
       * lets in.
       *
       * Warehouse staff are still out: they can act on a single order
       * (pick list, pick, availability) but cannot browse them, so their
       * way in is the dashboard's picking queue, not this tab.
       */
      { label: 'Orders', path: '/orders', requires: canReadSchoolOrders, icon: 'Package' },
      {
        label: 'Receiving',
        path: '/receiving',
        requires: 'warehouse_receiving_and_shipping',
        icon: 'PackageOpen',
      },
      {
        label: 'Shipments',
        path: '/shipments',
        requires: 'warehouse_receiving_and_shipping',
        icon: 'Truck',
      },
      {
        label: 'Production Orders',
        path: '/production-orders',
        requires: 'production_orders',
        icon: 'Receipt',
      },
      // Finance only — the matrix reserves posting adjustments to them, and
      // the server refuses everybody else.
      {
        label: 'Inv. Adjustments',
        path: '/adjustments',
        requires: 'inventory_adjustments',
        icon: 'SlidersHorizontal',
      },
      /*
       * The design draws one destination here and reaches Warehouse
       * Transfers as a tab inside it — which is right for Finance, who hold
       * both. It leaves the two leads with no door at all: F25 grants them
       * transfers, and the entry above is Finance-only.
       *
       * So this appears for whoever can transfer but cannot adjust. Finance
       * still sees one item, as drawn, and reaches transfers by the tab.
       */
      {
        label: 'Stock Transfers',
        path: '/transfers',
        requires: (user) =>
          canMoveStockBetweenWarehouses(user) && !can(user, 'inventory_adjustments'),
        icon: 'ArrowLeftRight',
      },
      /*
       * "Backorders" is AsOne's own word and the one they use in the pack, so
       * it is the one on screen — renaming a thing the client already has a
       * name for costs more than it explains.
       *
       * It is worth knowing that nothing here is a record: an order is
       * backordered because it is paid for and its warehouse is short, and it
       * stops being one when that stops being true. The screen says so, so
       * nobody goes looking for something to create or resolve.
       */
      {
        label: 'Backorders',
        path: '/backorders',
        requires: 'backorder_transfers',
        icon: 'Clock',
      },
    ],
  },
  {
    label: 'Inventory & Products',
    items: [
      // Readable by every role, and the server scopes the rows: a warehouse
      // clerk sees their site, a school sees the warehouse that serves it.
      { label: 'Inventory', path: '/inventory', requires: null, icon: 'Boxes' },

      /*
       * The audit trail — every movement of every SKU, in order. A separate
       * destination from Inventory because they answer different questions:
       * Inventory says how much is there, this says how it got that way.
       * Warehouse staff see their own site; Finance and the leads see all.
       *
       * Not `null`. A school reads stock levels at the warehouse that serves
       * it, but not the ledger behind them — that is every movement at every
       * site, including other schools' picks. `StockMovementViewSet` refuses
       * them, and this entry used to lead them to the 403.
       */
      {
        label: 'Stock History',
        path: '/stock-history',
        requires: canReadStockHistory,
        icon: 'History',
      },

      /*
       * Not `null`. A kit is a way of ordering, and F33 turns it into
       * component SKUs the moment an order is placed — a warehouse never
       * picks or counts one, and KitViewSet gives them no read access. The
       * entry used to be visible to everyone and led a warehouse clerk to a
       * guaranteed 403.
       */
      { label: 'Uniform Kits', path: '/kits', requires: canReadKits, icon: 'Shirt' },

      /*
       * Garments and SKUs are deliberately not destinations.
       *
       * They were entries to placeholder screens, added when nothing in the
       * app could reach those tables at all. Inventory now covers both: its
       * Stock tab *is* the SKU list, creating a SKU is its primary action,
       * and New garment and New size sit behind that button's caret — which
       * is where you discover one is missing, halfway through building a
       * SKU.
       *
       * Two sidebar entries leading to "this screen is not built yet" were
       * worse than none: they made the app look like it had four tables
       * when it had one working screen. Removed 17 September 2026.
       */
      /*
       * Pricing is not a destination either.
       *
       * A price is an attribute of a garment, so it lives on the Garments
       * tab of Inventory beside the thing it prices — a screen called
       * "Pricing" would have been the garment table with one extra column
       * and a name that hid what it was. Removed 17 September 2026.
       */
    ],
  },
  {
    label: 'Locations',
    items: [
      // Master data. Several roles may *read* these tables, but only the
      // Table Updates column may change them, and management is what these
      // screens are for — so the whole group follows that column.
      { label: 'Schools', path: '/schools', requires: 'table_updates', icon: 'School' },
      { label: 'Warehouses', path: '/warehouses', requires: 'table_updates', icon: 'Warehouse' },
      {
        label: 'Tailoring Centers',
        path: '/tailoring-centers',
        requires: 'table_updates',
        icon: 'SewingMachine',
      },
    ],
  },
  {
    label: 'Profile & Account',
    items: [
      // /auth/users/ is Program Lead and Operations Manager only.
      { label: 'Users & Roles', path: '/users', requires: 'table_updates', icon: 'Users' },
      // Your own account — everyone has one.
      { label: 'Settings', path: '/settings', requires: null, icon: 'Settings' },
    ],
  },
]

/** Every item, flattened — for registering routes and looking one up. */
export const ALL_NAV_ITEMS: readonly NavItem[] = NAVIGATION.flatMap((group) => group.items)

/**
 * The nav item a path belongs to, or null for a path outside the menu.
 *
 * Lets a screen name itself from the same model the sidebar draws from,
 * rather than repeating its title in a route table.
 */
export function findNavItem(path: string): NavItem | null {
  return ALL_NAV_ITEMS.find((item) => item.path === path) ?? null
}

/**
 * The group holding the destination a path belongs to, or null.
 *
 * Longest matching path wins, so a detail route picks the transfer
 * entry rather than whichever adjustment route happens to be listed first —
 * the same rule `helpFor` uses, for the same reason.
 */
export function groupForPath(pathname: string): string | null {
  let best: { label: string; length: number } | null = null

  for (const group of NAVIGATION) {
    for (const item of group.items) {
      if (!pathname.startsWith(item.path)) continue
      if (!best || item.path.length > best.length) {
        best = { label: group.label, length: item.path.length }
      }
    }
  }

  return best?.label ?? null
}
