/**
 * Needs Attention — Figma 2001:877.
 *
 * The rows come from `/dashboard/attention/` already worded, counted and
 * graded, so this only chooses how a severity looks. That matters more than
 * it sounds: the bell reads the same source, so the two cannot describe the
 * same problem differently — which they did while the client was composing
 * these sentences itself.
 *
 * An empty list is a good outcome here and says so.
 */

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Panel, SkeletonRows } from '@/components'
import { alertPath, alertTone } from '@/domain/status'
import { PREVIEW } from '../previewLimits'
import type { DashboardData } from '../hooks/useDashboardData'

export function NeedsAttention({ data }: { data: DashboardData }) {
  const { alerts, loading } = data
  const shown = alerts.slice(0, PREVIEW.alerts)
  const navigate = useNavigate()

  return (
    <Panel
      title="Needs Attention"
      minHeight="var(--panel-h-attention)"
      busy={loading.alerts}
      meta={
        !loading.alerts && alerts.length > 0 ? (
          <span className="panel__count">
            {alerts.length} ALERT{alerts.length === 1 ? '' : 'S'}
          </span>
        ) : undefined
      }
    >
      {loading.alerts ? (
        <SkeletonRows rows={3} />
      ) : alerts.length === 0 ? (
        <p className="panel__clear">
          <CheckCircle2 size={18} aria-hidden />
          All clear — nothing needs attention at this location.
        </p>
      ) : (
        <ul className="attention">
          {shown.map((alert) => {
            const to = alertPath(alert.kind, alert.ref_id)
            return (
              <li
                className={`attention__item${to ? ' attention__item--clickable' : ''}`}
                key={`${alert.kind}-${alert.message}`}
                {...(to
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      onClick: () => navigate(to),
                      onKeyDown: (event: KeyboardEvent) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          navigate(to)
                        }
                      },
                    }
                  : {})}
              >
                <span className="attention__label">
                  <AlertTriangle size={18} aria-hidden />
                  {alert.message}
                </span>
                <span className={`attention__tag attention__tag--${alertTone(alert.level)}`}>
                  {alert.level}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {/*
        Should not happen: the cap is the number of alert kinds the server
        defines, so every row fits. Kept as the signal that a new kind has
        been added and this limit needs raising — the alternative was a
        permanent "+1 more" pointing at nothing, since these rows span
        several screens and there is no one place to send someone.
      */}
      {!loading.alerts && alerts.length > shown.length && (
        <p className="panel__more">
          +{alerts.length - shown.length} more — open the bell to see them all
        </p>
      )}
    </Panel>
  )
}
