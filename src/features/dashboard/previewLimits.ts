/**
 * How much of each list the home screen shows.
 *
 * A dashboard is a summary: it should answer "is anything wrong" at a glance,
 * not reproduce the screens behind it. Each panel shows this many rows and
 * links to the full view when there are more.
 *
 * The numbers follow the design's own panels — five timeline entries, four
 * alerts — and are gathered here so tuning them is one edit rather than a
 * hunt through components.
 */

export const PREVIEW = {
  /**
   * AsOne runs two warehouses today, so all of them fit. Five leaves room to
   * grow before the panel turns into a list, and the comparison stays
   * readable — bars scaled against the largest stop meaning much past that.
   */
  warehouses: 5,
  /**
   * Every alert there can be.
   *
   * The design shows four and this followed it, which produced a permanent
   * "+1 more needing attention" with nowhere to go: the list is not a feed
   * of events but one row per *kind* of problem, and the server defines six
   * — low stock, orders on hold, pending registrations, fillable
   * backorders, unconfirmed deliveries, unreconciled receipts. Capping at
   * four hid a real problem behind a line of text that was not a link,
   * because there is no single screen to link to.
   *
   * Six one-line rows is a short panel, and the cap stays so that adding a
   * seventh kind is noticed rather than silently dropped.
   */
  alerts: 6,
  /** The design shows five. */
  activity: 5,
} as const
