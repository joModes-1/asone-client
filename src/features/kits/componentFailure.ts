/**
 * Turning the server's refusal of a kit component into a sentence.
 *
 * Its own module rather than an export from a screen: both the create and
 * the edit screen need it, and a component file that also exports a
 * function breaks fast refresh.
 */

import type { Sku } from '@/api/types'

/**
 * A refused component, said as a sentence naming the row.
 *
 * The server answers `{"items": {"1": ["UNI-P57-… is cut for Upper Primary,
 * but this kit is for Nursery"]}}` — keyed by position in the table, so the
 * line can be pointed at rather than the form as a whole.
 *
 * Null for anything else, which leaves the general error alert to say it.
 */
export function componentFailure(
  error: unknown,
  lines: { sku: number | null }[],
  skuOf: (id: number | null) => Sku | undefined,
): string | null {
  const items = (error as { response?: { data?: { items?: unknown } } })?.response?.data
    ?.items
  if (!items || typeof items !== 'object') return null

  const named = Object.entries(items as Record<string, string[]>).map(
    ([index, messages]) => {
      const line = lines[Number(index)]
      const sku = line ? skuOf(line.sku) : undefined
      const where = sku?.number ?? `line ${Number(index) + 1}`
      return `${where}: ${[messages].flat().join(' ')}`
    },
  )

  if (named.length === 0) return null

  // "Nothing was created" first. The old two-call version left a kit behind
  // when a component was refused, so anybody who saw that message once will
  // assume this one means the same.
  return `Nothing was created. ${named.length === 1 ? 'One component was' : `${named.length} components were`} refused — ${named.join('; ')}.`
}
