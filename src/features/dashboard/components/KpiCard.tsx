/**
 * A dashboard KPI tile — Figma 2001:802.
 *
 * Structurally different from the shared `StatCard` (design system §06), and
 * deliberately its own component rather than a restyle of it: here the icon
 * pairs with the *figure* and the category label sits underneath, where
 * StatCard pairs the icon with the label and leads with the figure. Forcing
 * one into the other with CSS ordering cannot regroup the icon, and would
 * break the moment either design moved.
 *
 * `value` is a string. Every figure on this screen is either formatted money
 * or a formatted count, and neither should arrive as a raw number.
 *
 * `to` makes the tile a link. Optional, because most figures have nowhere
 * useful to go — a tile that navigates somewhere unrelated is worse than one
 * that does nothing. Where a figure *is* a to-do list, the number is the most
 * obvious thing to click, and it should look clickable rather than only
 * behave that way.
 */

import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

interface KpiCardProps {
  /** The category, shown last — "Available Stock". */
  label: string
  /** The figure, already formatted — "16,482", "UGX 48.2M", or "—". */
  value: string
  /** What the figure means — "Items ready in bins". */
  caption: string
  icon: LucideIcon
  /** Draws attention without implying failure. */
  tone?: 'default' | 'alert'
  /** Where this figure is answered. Omit for a tile that is only read. */
  to?: string
}

export function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  tone = 'default',
  to,
}: KpiCardProps) {
  const className = `kpi${tone === 'alert' ? ' kpi--alert' : ''}${to ? ' kpi--link' : ''}`

  const body = (
    <>
      <p className="kpi__figure">
        <Icon size={18} aria-hidden className="kpi__icon" />
        <span className="kpi__value t-numeric">{value}</span>
      </p>
      <p className="kpi__caption">{caption}</p>
      <p className="kpi__label">{label}</p>
    </>
  )

  /*
   * A real anchor, not a div with an onClick: it has to be reachable by
   * keyboard, openable in a new tab, and announced as a link.
   */
  if (to) {
    return (
      <Link className={className} to={to}>
        {body}
      </Link>
    )
  }

  return <div className={className}>{body}</div>
}
