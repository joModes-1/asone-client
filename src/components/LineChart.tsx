/**
 * A line chart, themed once.
 *
 * ApexCharts underneath, but no screen configures ApexCharts directly. Every
 * chart in this app goes through here, so the axis colour, the grid, the
 * fonts, the tooltip and the palette are decided in one file rather than
 * copied into each caller — the same reason `Badge` exists rather than a
 * `<span className="badge">` per screen.
 *
 * ---------------------------------------------------------------------------
 * The colours come from tokens.css, at runtime
 * ---------------------------------------------------------------------------
 * ApexCharts takes colours as strings, not CSS custom properties, so a token
 * cannot simply be handed to it. They are read off the document once per
 * render instead. That keeps `tokens.css` the single source of the brand —
 * change `--accent` there and every line moves with it — and it means a
 * theme switch is picked up rather than baked in at build time.
 *
 * ---------------------------------------------------------------------------
 * Loaded lazily
 * ---------------------------------------------------------------------------
 * ApexCharts is around 500kB. Most screens in this app have no chart on
 * them, and a warehouse clerk on a phone should not pay for one to look at a
 * pick list — so it arrives in its own chunk, only on the screens that draw
 * one, behind a skeleton the same height as the chart it replaces.
 */

import { Suspense, lazy, useMemo } from 'react'
import { Skeleton } from './Skeleton'

const ReactApexChart = lazy(() => import('react-apexcharts'))

export interface LineSeries {
  name: string
  data: number[]
}

interface LineChartProps {
  series: readonly LineSeries[]
  /** One label per point — dates, usually. */
  categories: readonly string[]
  height?: number
  /** Formats a value in the tooltip and on the y-axis. */
  format?: (value: number) => string
  /**
   * Whole numbers only on the y-axis. True for anything counted — orders,
   * units, people — where a tick reading 2.5 names a value that cannot
   * occur.
   */
  integer?: boolean
  /** Names what the y-axis counts, for a screen reader. */
  label: string
}

/**
 * Reads a CSS custom property off the document.
 *
 * ApexCharts writes its colours as SVG `fill` and `stroke` **attributes**,
 * and a custom property does not resolve in an attribute — so unlike every
 * other colour in this app these have to be read as values rather than
 * referred to. This is the one place that is true.
 *
 * It used to take a hardcoded hex fallback per token, which put nine brand
 * colours in this file duplicating tokens.css with nothing keeping them in
 * step. They were also unreachable: tokens.css is imported by `main.tsx` and
 * this component is lazy-loaded long after, so the property is always there.
 *
 * If one ever is not, that is a missing token — a bug worth seeing rather
 * than papering over with a stale copy of what it used to be.
 */
function token(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  if (!value && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`LineChart: ${name} is not defined in tokens.css`)
  }

  return value
}

export function LineChart({
  series,
  categories,
  height = 280,
  format,
  integer = false,
  label,
}: LineChartProps) {
  const peak = series.reduce(
    (max, entry) => entry.data.reduce((inner, value) => Math.max(inner, value), max),
    0,
  )
  /*
    Roughly eight dates across, whatever the month's length — a panel this
    wide fits about that many before "Aug 23" starts touching "Aug 24".

    Thinned here rather than by the library. `hideOverlappingLabels` drops a
    label only once it has already collided, which printed
    "Sep 8 Sep 9Sep 10" over itself; `tickAmount` on a *category* axis forces
    one label per tick and made it worse; and the label `formatter`'s `opts.i`
    is not the category index, so striding there thinned nothing. Blanking
    the categories themselves is the one version that does not depend on the
    library's own measuring.

    The tooltip keeps every date — see `tooltip.x` below — so nothing is lost
    by not printing them all.
  */
  const stride = Math.max(1, Math.ceil(categories.length / 8))
  const axisLabels = categories.map((label, index) => (index % stride === 0 ? label : ''))

  const options = useMemo(() => {
    const accent = token('--accent')
    const ink = token('--text-secondary')
    const muted = token('--text-muted')
    const rule = token('--table-rule')

    /*
      A brand-led ramp rather than ApexCharts' defaults. The first series is
      the brand green because on a single-warehouse chart it is the only
      line, and it should look like the rest of the app. The rest are chosen
      to stay distinguishable side by side and in greyscale, since these
      screens get printed.
    */
    const palette = [
      accent,
      token('--asone-ocean'),
      token('--asone-earth'),
      token('--warning'),
      token('--info'),
    ]

    return {
      chart: {
        type: 'area' as const,
        height,
        /*
          A soft shadow lifts the line off the grid. Subtle on purpose — it
          is depth, not decoration, and at any more the line starts to look
          like it is floating away from the values it plots.
        */
        dropShadow: {
          enabled: true,
          top: 3,
          left: 0,
          blur: 6,
          opacity: 0.12,
        },
        fontFamily: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
        // The default animation redraws on every filter change, which on a
        // dashboard that refetches reads as flicker rather than motion.
        animations: { enabled: false },
        background: 'transparent',
      },
      colors: palette,
      /*
        Curved, with the markers left on.

        A spline bulges between the points it joins — between a 4 and a 9 it
        can pass through 3, which is a day that never happened. That is why
        this was straight to begin with, and it is still true. What makes the
        curve safe to use is the markers: every reading is drawn as a dot, so
        the values are the dots and the line between them is the trend. Read
        that way the curve is honest, and it is the shape AsOne asked for.

        `monotoneCubic` rather than `smooth` for the same reason — it is the
        one ApexCharts curve that will not overshoot a point, so the line
        cannot rise above a peak the data never reached.
      */
      stroke: {
        curve: 'monotoneCubic' as const,
        width: 3,
        lineCap: 'round' as const,
      },

      /*
        A gradient washing out downwards, which is what makes a line chart
        read as a *quantity* rather than a squiggle — the filled area is the
        volume under it.

        It washes out almost to nothing at the baseline, because two
        warehouses overlap here: hold the opacity through the whole drop and
        the lower series is read through a tint of the upper one, and both
        colours go muddy.
      */
      fill: {
        type: 'gradient' as const,
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.03,
          stops: [0, 100],
        },
      },
      /*
        A dot on every reading. The line is drawn straight between points, so
        the markers are what say where a measurement actually was — without
        them a run of equal days looks like one long observation rather than
        five.
      */
      markers: {
        size: 4,
        strokeWidth: 2,
        strokeColors: token('--surface'),
        hover: { size: 7 },
      },
      dataLabels: { enabled: false },
      grid: {
        borderColor: rule,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        // Room for the markers, which would otherwise be clipped in half at
        // the first and last reading.
        padding: { left: 12, right: 12, top: 4 },
      },
      xaxis: {
        categories: axisLabels,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: muted, fontSize: '12px' },
          rotate: 0,
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        /*
          One tick per whole number up to the peak, capped at five. Left to
          itself ApexCharts divides the range evenly and produced 0.5, 1.5,
          2.5 for a count of orders — ticks naming values that cannot exist,
          and duplicated once the formatter rounded them.
        */
        ...(integer ? { tickAmount: Math.max(1, Math.min(peak, 5)) } : {}),
        forceNiceScale: !integer,
        decimalsInFloat: integer ? 0 : undefined,
        labels: {
          style: { colors: muted, fontSize: '12px' },
          formatter: (value: number) => (format ? format(value) : String(Math.round(value))),
        },
      },
      legend: {
        // Hidden for a single line: a legend naming the only series on the
        // chart is a label for something already in the panel's title.
        show: series.length > 1,
        position: 'top' as const,
        horizontalAlign: 'left' as const,
        fontSize: '12px',
        labels: { colors: ink },
        markers: { size: 6 },
        itemMargin: { horizontal: 10 },
      },
      tooltip: {
        shared: true,
        intersect: false,
        // The real date for every point, including the ones the axis does
        // not print.
        x: {
          formatter: (_value: number, opts?: { dataPointIndex?: number }) =>
            categories[opts?.dataPointIndex ?? 0] ?? '',
        },
        y: { formatter: (value: number) => (format ? format(value) : String(value)) },
      },
    }
  }, [axisLabels, categories, format, height, integer, peak, series.length])

  return (
    <div className="chart" role="img" aria-label={label}>
      <Suspense fallback={<Skeleton height={`${height}px`} />}>
        <ReactApexChart
          type="area"
          height={height}
          options={options}
          series={series as LineSeries[]}
        />
      </Suspense>
    </div>
  )
}
