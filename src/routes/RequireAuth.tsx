/**
 * Route guard.
 *
 * Shows the loading screen while the session is still being established. A
 * guard that treats 'loading' as 'anonymous' bounces a signed-in user to
 * sign-in for a frame on every reload, which is the single most common way
 * this goes wrong.
 *
 * Cosmetic, like every guard: the server re-checks each request, so a 403 is
 * always possible on the other side of this.
 */

import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { LoadingScreen, ServerUnreachable } from '@/components'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { paths } from './paths'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, retry } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingScreen message="Checking your session…" />

  // Tokens are still held and the server simply did not answer. Redirecting
  // to sign-in here would be the silent-logout bug in another form.
  if (status === 'unreachable') return <ServerUnreachable onRetry={retry} />

  if (status === 'anonymous' || status === 'challenged') {
    return <Navigate to={paths.signIn} replace state={{ from: location.pathname }} />
  }

  /*
    Not cosmetic, unlike the rest of this guard.

    The server refuses **every** request from an account that still holds the
    password it was handed — `403 "Set a new password before using the
    system."` Letting a gated user through drew the whole shell with nothing
    in it: an empty sidebar, "Your dashboard could not be loaded", and no
    hint that one step was missing. They are sent to take it instead.
  */
  if (status === 'gated' && location.pathname !== paths.setPassword) {
    return <Navigate to={paths.setPassword} replace />
  }

  return <>{children}</>
}
