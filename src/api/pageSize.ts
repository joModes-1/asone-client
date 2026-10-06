/**
 * How many rows a paginated list shows at once.
 *
 * One number for the whole system. It used to be four: 10 here, 15 there, 50
 * on the location screens, and a couple of hooks that named a size for the
 * footer and never sent it to the server at all — so the footer counted in
 * fifteens while DRF paged in fifties, and the controls never appeared no
 * matter how many rows there were.
 *
 * Ten, because every one of these tables is a list somebody works down
 * rather than a document they read, and because AsOne's real data is small:
 * fourteen accounts, twelve production orders, five schools. At fifteen most
 * of these screens are one page, which is the same as having no paging at
 * all — and the first thing anybody asks of a table is how much is behind
 * it.
 *
 * Two things deliberately do not use it:
 *
 *   * A table showing the lines of **one** record — a shipment's lines, a
 *     kit's components, an order's items. Those are bounded by the record
 *     and paging them would hide part of the thing you opened.
 *   * The handful of hooks that pass `page_size: 100` to fetch a whole small
 *     set at once. They are not lists with controls; they are a way of
 *     saying "all of them", and each says so where it is written.
 */
export const LIST_PAGE_SIZE = 10

/**
 * The most rows the server will return in one request.
 *
 * `config.pagination.SizedPageNumberPagination` caps `page_size` at 200 so
 * no caller can pull a whole table in one go. Named here because asking for
 * more silently gets you 200, which is how a screen ends up quietly missing
 * rows — see `fetchAll`.
 */
export const MAX_PAGE_SIZE = 200

/**
 * Every row of a list endpoint, however many pages that takes.
 *
 * For the handful of places that genuinely need the whole set rather than a
 * page: matching an uploaded stock count against the catalogue, and building
 * the inventory table, which is one row per SKU per warehouse.
 *
 * Those asked for `page_size: 200` and used what came back. AsOne's real
 * catalogue is 308 SKUs, so 108 of them were simply absent — the inventory
 * table was short without saying so, and a stock count naming any of them
 * was rejected as "Unknown SKU". It worked on a demo database of 37 and
 * failed on the live one, which is the worst way for a limit to show up.
 *
 * Stops at `count`, so a server that keeps answering cannot spin this
 * forever.
 */
export async function fetchAll<T>(
  page: (params: { page: number; page_size: number }) => Promise<{ count: number; results: T[] }>,
): Promise<T[]> {
  const first = await page({ page: 1, page_size: MAX_PAGE_SIZE })
  const all = [...first.results]

  const pages = Math.ceil(first.count / MAX_PAGE_SIZE)
  for (let n = 2; n <= pages; n += 1) {
    const next = await page({ page: n, page_size: MAX_PAGE_SIZE })
    if (next.results.length === 0) break
    all.push(...next.results)
  }

  return all
}
