/**
 * Alert banner — section 09.
 *
 * For a message about the state of things. Errors get the sentence the
 * server sent, never a generic apology.
 */

import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Tone } from './Badge'

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  neutral: Info,
} as const

interface AlertProps {
  tone?: Exclude<Tone, 'neutral'>
  children: ReactNode
}

export function Alert({ tone = 'info', children }: AlertProps) {
  const Icon = ICONS[tone]
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  )
}
