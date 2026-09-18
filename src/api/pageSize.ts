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
