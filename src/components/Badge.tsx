/**
 * Status badge — section 05.
 *
 * Tone is a presentation choice, not a business rule. Deciding which tone a
 * given order status gets belongs in `domain/`, so that the mapping is
 * testable and this component stays dumb.
 */

import type { ReactNode } from 'react'

/**
 * What something *is* — good, bad, or worth a look.
 *
 * Anything that carries a judgement uses these, and only these. `Alert` is
 * built on them, which is why it takes a `Tone` and not the identity
 * colours below: an alert is a judgement by definition.
 */
export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

/**
 * Which one of several — where no value is better than another.
 *
 * The five roles, today. Kept apart from `Tone` because green means
 * confirmed and red means wrong, so a role wearing either would read as a
 * verdict on the person rather than as their job. See the identity colours
 * in tokens.css; `domain/access.roleTone` does the mapping.
 */
export type IdentityTone = 'purple' | 'teal' | 'amber' | 'rose'

interface BadgeProps {
  /** A badge is the one place both kinds of colour are legitimate. */
  tone?: Tone | IdentityTone
  children: ReactNode
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
