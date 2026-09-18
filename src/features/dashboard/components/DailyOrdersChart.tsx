/**
 * Daily Orders This Month — Figma 2001:971.
 *
 * One line per warehouse when the top-bar filter is on "All warehouses", and
 * one line when it is narrowed to a site. Comparing the two is the point: a
 * single combined line hides the case worth seeing, where one warehouse is
 * flat while the other is busy.
 *
 * Drawn through the shared `LineChart`, which is ApexCharts with this app's
 * tokens applied — so the axis, grid, palette and tooltip are decided once
 * rather than per screen. This was a hand-drawn SVG, which was the right
 * call while there was one series and no tooltip; two lines that a reader
 * needs to compare at a given date is where that stops being true.
 *
 * The figures under the title are across every line drawn, so they agree
 * with what is on the chart rather than with one warehouse of it.
 */

import { Panel, Skeleton, LineChart } from '@/components'
import { formatQuantity } from '@/domain/money'
import type { DailyOrders } from '../hooks/useDailyOrders'

/** "14 Sep" — short, because a month of them shares one axis. */
function shortDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

export function DailyOrdersChart({ data }: { data: DailyOrders }) {
  const { series, days, average, total, isLoading, isError } = data

  const categories = days.map((day) => shortDay(day.date))
  const lines = series.map((entry) => ({
    name: entry.name,
    /*
      Padded to the axis. A warehouse whose series came back short would
      otherwise have its line drawn against the wrong dates rather than
      simply ending early.
    */
    data: categories.map((_, index) => entry.days[index]?.orders ?? 0),
  }))

  return (
    <Panel
      title="Daily Orders This Month"
      minHeight="var(--panel-h-chart)"
      busy={isLoading}
      meta={
        <span className="panel__meta">Avg: {formatQuantity(average)} orders/day</span>
      }
    >
      {isLoading ? (
        <Skeleton height="240px" />
      ) : isError ? (
        /* Silent failure would draw a flat line at zero, which reads as a
           month with no orders rather than as a chart that did not load. */
        <p className="panel__clear">
          The order volume could not be loaded, so this is not a picture of
          the month.
        </p>
      ) : days.length === 0 || total === 0 ? (
        <p className="panel__clear">No orders placed this month.</p>
      ) : (
        <LineChart
          series={lines}
          categories={categories}
          height={260}
          integer
          format={(value) => formatQuantity(value)}
          label={
            lines.length > 1
              ? `Orders per day this month, one line per warehouse: ${lines.map((line) => line.name).join(', ')}. ${formatQuantity(total)} in total.`
              : `${formatQuantity(total)} orders this month, averaging ${average} a day`
          }
        />
      )}
    </Panel>
  )
}
