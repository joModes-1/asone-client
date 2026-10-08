/**
 * TEMPORARY — goes with `domain/phase.ts`. Delete both together.
 *
 * The gate decides what a client sees in a testing session, and it is driven
 * by an environment variable that nobody looks at twice. The failure modes are
 * both silent: a typo hides half the app, or a path is gated in the menu and
 * left reachable by URL. Neither shows up as an error, so they are asserted
 * here instead.
 *
 * `PHASE` is read once at module load, so each case re-imports the module with
 * `resetModules` rather than trying to change it in place.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadWithPhase(value: string | undefined) {
  vi.resetModules()
  if (value === undefined) vi.stubEnv('VITE_PHASE', '')
  else vi.stubEnv('VITE_PHASE', value)
  return import('./phase')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('the phase gate', () => {
  it('shows everything when VITE_PHASE is unset', async () => {
    const { PHASE, pathOpenInThisPhase } = await loadWithPhase(undefined)

    expect(PHASE).toBe(3)
    // The case that matters most: a developer who has never heard of this
    // file sees the app exactly as it was before the gate existed.
    for (const path of ['/orders', '/shipments', '/backorders', '/adjustments', '/transfers']) {
      expect(pathOpenInThisPhase(path)).toBe(true)
    }
  })

  it('shows Foundation only when VITE_PHASE is 0', async () => {
    const { PHASE, pathOpenInThisPhase } = await loadWithPhase('0')

    // The regression that sent a Foundation build to production showing
    // everything: the parse rejected 0 as "not a phase" and fell back to the
    // widest view, so the narrowest request produced the opposite of it.
    expect(PHASE).toBe(0)

    for (const closed of [
      '/receiving',
      '/production-orders',
      '/group-orders',
      '/stock-history',
      '/reports/procurement-costs',
      '/adjustments',
      '/transfers',
      '/orders',
      '/shipments',
      '/backorders',
    ]) {
      expect(pathOpenInThisPhase(closed)).toBe(false)
    }

    // What a client needs to stand the system up.
    for (const open of [
      '/dashboard',
      '/inventory',
      '/kits',
      '/schools',
      '/warehouses',
      '/tailoring-centers',
      '/users',
      '/profile',
      '/settings',
      // Pricing is master data, and setting prices is Foundation work. The
      // price list is the one report that belongs with it.
      '/reports',
      '/reports/price-list',
    ]) {
      expect(pathOpenInThisPhase(open)).toBe(true)
    }
  })

  it('gates a sub-report without gating its parent', async () => {
    const { pathOpenInThisPhase } = await loadWithPhase('0')

    // `/reports/procurement-costs` sits under `/reports`. Longest prefix
    // decides, so declaration order in the map cannot change the answer.
    expect(pathOpenInThisPhase('/reports')).toBe(true)
    expect(pathOpenInThisPhase('/reports/price-list')).toBe(true)
    expect(pathOpenInThisPhase('/reports/procurement-costs')).toBe(false)
  })

  it('hides phase 2 and 3 work from a phase 1 build', async () => {
    const { pathOpenInThisPhase } = await loadWithPhase('1')

    expect(pathOpenInThisPhase('/orders')).toBe(false)
    expect(pathOpenInThisPhase('/shipments')).toBe(false)
    expect(pathOpenInThisPhase('/backorders')).toBe(false)
    expect(pathOpenInThisPhase('/transfers')).toBe(false)
  })

  it('opens stock corrections in a phase 1 build', async () => {
    /* On AsOne's agreed Phase 1 list: "Stock correction — fix a wrong
       quantity, with reason and audit trail". It was gated to phase 2,
       which also contradicted the stock-count import: that sits on
       Inventory in Foundation and posts an adjustment, so a count could be
       imported while the screen showing what it did stayed hidden. */
    const { pathOpenInThisPhase } = await loadWithPhase('1')

    expect(pathOpenInThisPhase('/adjustments')).toBe(true)
  })

  it('leaves phase 1 work open in a phase 1 build', async () => {
    const { pathOpenInThisPhase } = await loadWithPhase('1')

    // Receiving and production orders are the point of Phase 1 testing; the
    // shell and the catalogue have to come with them or there is no app.
    for (const path of [
      '/dashboard',
      '/receiving',
      '/production-orders',
      '/inventory',
      '/stock-history',
      '/kits',
      '/schools',
      '/warehouses',
      '/tailoring-centers',
      '/users',
      '/profile',
      '/settings',
      '/reports',
    ]) {
      expect(pathOpenInThisPhase(path)).toBe(true)
    }
  })

  it('opens adjustments at phase 2 but still holds outbound back', async () => {
    const { pathOpenInThisPhase } = await loadWithPhase('2')

    expect(pathOpenInThisPhase('/adjustments')).toBe(true)
    expect(pathOpenInThisPhase('/transfers')).toBe(true)
    expect(pathOpenInThisPhase('/shipments')).toBe(false)
    expect(pathOpenInThisPhase('/orders')).toBe(false)
  })

  it('gates a detail page with its list', async () => {
    const { pathOpenInThisPhase } = await loadWithPhase('1')

    // Gating `/shipments` and leaving `/shipments/SH-5007` reachable is worse
    // than not gating at all: the tester who finds it has already been told
    // the area is closed.
    expect(pathOpenInThisPhase('/shipments/SH-5007')).toBe(false)
    expect(pathOpenInThisPhase('/orders/SO-20044')).toBe(false)
  })

  it('does not gate a path that merely starts with the same letters', async () => {
    const { pathOpenInThisPhase } = await loadWithPhase('1')

    // `/orders` must not swallow `/production-orders`, and a future
    // `/transfers-report` must not be caught by `/transfers`.
    expect(pathOpenInThisPhase('/production-orders')).toBe(true)
    expect(pathOpenInThisPhase('/transfers-report')).toBe(true)
  })

  it('shows everything when VITE_PHASE is nonsense, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { PHASE, pathOpenInThisPhase } = await loadWithPhase('phase one')

    // A typo must not quietly ship a crippled build to a client.
    expect(PHASE).toBe(3)
    expect(pathOpenInThisPhase('/shipments')).toBe(true)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('treats a phase past the last one as everything', async () => {
    const { pathOpenInThisPhase } = await loadWithPhase('9')
    expect(pathOpenInThisPhase('/shipments')).toBe(true)
  })
})
