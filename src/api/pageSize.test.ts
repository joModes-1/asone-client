/**
 * `fetchAll` exists because a 200-row ceiling silently truncated the
 * catalogue. These pin the behaviour that matters: it must keep going past
 * the first page, and it must stop.
 */

import { describe, expect, it, vi } from 'vitest'
import { fetchAll, MAX_PAGE_SIZE } from './pageSize'

/** A server holding `total` rows, paging at the real ceiling. */
function server(total: number) {
  return vi.fn(async ({ page, page_size }: { page: number; page_size: number }) => {
    const from = (page - 1) * page_size
    return {
      count: total,
      results: Array.from({ length: Math.max(0, Math.min(page_size, total - from)) }, (_, i) => ({
        id: from + i + 1,
      })),
    }
  })
}

describe('fetchAll', () => {
  it('returns everything past the first page', async () => {
    /* AsOne's real catalogue: 308 SKUs against a ceiling of 200. This is
       the exact case that failed on live and passed on a 37-row demo. */
    const page = server(308)

    const all = await fetchAll(page)

    expect(all).toHaveLength(308)
    expect(page).toHaveBeenCalledTimes(2)
  })

  it('asks for the largest page the server allows', async () => {
    const page = server(10)

    await fetchAll(page)

    expect(page).toHaveBeenCalledWith({ page: 1, page_size: MAX_PAGE_SIZE })
  })

  it('makes one request when everything fits', async () => {
    const page = server(37)

    const all = await fetchAll(page)

    expect(all).toHaveLength(37)
    expect(page).toHaveBeenCalledTimes(1)
  })

  it('handles an empty list', async () => {
    const page = server(0)

    expect(await fetchAll(page)).toEqual([])
    expect(page).toHaveBeenCalledTimes(1)
  })

  it('stops rather than spinning when a server keeps answering', async () => {
    /* A count that never matches what arrives would otherwise loop for
       ever. Bounded by count, and by an empty page. */
    const page = vi.fn(async () => ({ count: 1_000_000, results: [] as { id: number }[] }))

    const all = await fetchAll(page)

    expect(all).toEqual([])
    expect(page).toHaveBeenCalledTimes(2)
  })

  it('does not lose a partial last page', async () => {
    const all = await fetchAll(server(201))

    expect(all).toHaveLength(201)
  })
})
