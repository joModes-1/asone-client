/**
 * The reports index — Figma 58:2797.
 *
 * The design lists twenty-three reports in four categories. Nine of them map
 * to something the server can answer today; the rest do not exist, and
 * several describe things the domain has no concept of at all — drivers,
 * vehicles, grants, subsidies, per-size pricing.
 *
 * All twenty-three are listed anyway, because a reports index is a statement
 * of intent as much as a menu, and quietly dropping fourteen would make the
 * gap invisible to whoever has to close it. What is not built says so and
 * cannot be clicked.
 *
 * `endpoint` is recorded on the live ones so nobody has to work out where a
 * figure comes from, and `note` on the dead ones says what is missing —
 * those notes are the list to take to AsOne.
 */

import type { AccessFunction } from '@/api/types'

export type ReportCategoryId = 'inventory' | 'operations' | 'sales' | 'pricing'

export interface ReportEntry {
  title: string
  /** Marked in the design. Editorial, not derived from usage. */
  popular?: boolean
  /** Present when the server can answer it. */
  endpoint?: string
  /** The screen that shows it, when one exists. Without this the row is a
      promise the reports index cannot keep. */
  path?: string
  /** Why it cannot be built, for the ones that cannot. */
  note?: string
}

export interface ReportCategory {
  id: ReportCategoryId
  title: string
  icon: 'inventory' | 'operations' | 'schools' | 'pricing'
  /** Which access-matrix column opens this category. */
  requires: AccessFunction | null
  /** Route for "View Report", when the category has a screen. */
  path?: string
  reports: ReportEntry[]
}

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  {
    id: 'inventory',
    title: 'Inventory Reports',
    icon: 'inventory',
    requires: null,
    path: '/reports/inventory',
    reports: [
      {
        title: 'Inventory by Warehouse',
        popular: true,
        endpoint: '/dashboard/inventory-by-warehouse/',
      },
      {
        title: 'Safety Stock Threshold Breaches',
        popular: true,
        endpoint: '/inventory/reorder-alerts/',
      },
      { title: 'SKU Valuation Ledger', endpoint: '/inventory/stock-levels/' },
      {
        title: 'Dead Stock & Shrinkage Report',
        note: 'Needs shrinkage derived from adjustment reason codes; no endpoint groups them.',
      },
      {
        title: 'Tailoring Center Work-In-Progress',
        endpoint: '/procurement/production-orders/open/',
      },
      {
        title: 'Reconciliation Deficit Log',
        note: 'Reconciliation exists per group order, not as a standing report.',
      },
    ],
  },
  {
    id: 'operations',
    title: 'Operations Reports',
    icon: 'operations',
    requires: 'warehouse_receiving_and_shipping',
    reports: [
      {
        title: 'Dispatch Pick Queue Efficiency',
        popular: true,
        note: 'Efficiency needs timings the ledger does not record.',
      },
      { title: 'Vehicle Delivery Dispatch Schedules', note: 'No vehicles in the model.' },
      { title: 'Warehouse Transit Lead Times', note: 'Transfers carry no despatch or arrival time.' },
      {
        title: 'Tailor Production Output Audits',
        endpoint: '/procurement/reports/receipts-costed/',
        path: '/reports/procurement-costs',
      },
      { title: 'Receiving Variance Analysis', endpoint: '/procurement/receipts/' },
      { title: 'Pending Orders Backlog Status', endpoint: '/orders/reports/part-processed/' },
      { title: 'Driver Trip Logs', note: 'No drivers in the model.' },
    ],
  },
  {
    id: 'sales',
    title: 'Sales & Schools Reports',
    icon: 'schools',
    requires: null,
    reports: [
      {
        title: 'School Sizing Campaigns Valuation',
        popular: true,
        note: 'No concept of a sizing campaign.',
      },
      { title: 'Regional Uniform Grant Allocations', note: 'No grants in the model.' },
      { title: 'Direct School Sourcing Invoices', endpoint: '/orders/school-orders/' },
      {
        title: 'Term-Start Kit Fulfillment Rates',
        note: 'Needs a term calendar; orders carry a date, not a term.',
      },
      { title: 'Backorder Release Audits', endpoint: '/orders/reports/backorders/' },
      {
        title: 'School Direct Replenishment Cycles',
        note: 'Needs repeat-order analysis over time.',
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing Reports',
    icon: 'pricing',
    requires: 'financial_reports',
    path: '/reports/price-list',
    reports: [
      {
        title: 'Unit Production Cost Index',
        endpoint: '/procurement/reports/group-orders-costed/',
        path: '/reports/procurement-costs',
      },
      { title: 'School Direct Price Sheets', popular: true, endpoint: '/catalog/price-lists/' },
      { title: 'Regional Subsidy Ledger', note: 'No subsidies in the model.' },
      {
        title: 'Custom Sizing Premium Invoices',
        // Not merely missing — the domain rules it out.
        note: 'Price lives on the garment and never varies by size, so a size premium cannot exist.',
      },
    ],
  },
]

export function isLive(report: ReportEntry): boolean {
  return Boolean(report.endpoint)
}

/** How many of a category's reports the server can answer. */
export function liveCount(category: ReportCategory): number {
  return category.reports.filter(isLive).length
}
