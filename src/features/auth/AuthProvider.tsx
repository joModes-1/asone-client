/**
 * Owns the session.
 *
 * Three things happen here that nowhere else can:
 *
 *   On boot it asks `/auth/me/` who the stored token belongs to, so a
 *   reload does not sign anyone out. Until that answers, the status is
 *   'loading' and no screen may claim the visitor is anonymous — rendering
 *   sign-in for half a second before a session resolves is how an app looks
 *   broken.
 *
 *   It subscribes to the transport's two failure signals, which need
 *   opposite handling. `onSessionExpired` means the refresh token was
 *   rejected: sign out and say so. `onServerUnreachable` means the request
 *   never landed: keep the session, because nothing about it is wrong, and
 *   tell the user the server is not answering. Treating the second as the
 *   first used to sign people out whenever the backend restarted.
 *
 *   It distinguishes 'gated' from 'signedIn'. An account with
 *   `must_change_password` is authenticated but gets 403 on almost
 *   everything, so the app must treat it as a separate state rather than a
 *   signed-in user who happens to see errors everywhere.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as authApi from '@/api/auth'
import { toApiError, type ApiError } from '@/api/errors'
import { onServerUnreachable, onSessionExpired } from '@/api/http'
import { snackbar } from '@/components'
import { tokens } from '@/api/tokens'
import type { CurrentUser, LoginChallenge } from '@/api/types'
import { fullName, mustChangePassword } from '@/domain/access'
import { AuthContext, type AuthState, type AuthStatus } from './AuthContext'

function statusFor(user: CurrentUser): AuthStatus {
  return mustChangePassword(user) ? 'gated' : 'signedIn'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialised from token presence rather than corrected in an effect: with
  // no stored token there is nothing to ask the server, and starting at
  // 'loading' would blank the sign-in screen for a frame.
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokens.access ? 'loading' : 'anonymous',
  )
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)

  // Guards against a resolved boot request writing state after the provider
  // has moved on — a sign-out landing before a slow /auth/me/ returns.
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const adopt = useCallback((next: CurrentUser) => {
    setUser(next)
    setChallenge(null)
    setStatus(statusFor(next))
  }, [])

  const clear = useCallback(() => {
    setUser(null)
    setChallenge(null)
    setStatus('anonymous')
  }, [])

  // Bumped to re-run the boot check after an outage.
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((count) => count + 1)
  }, [])

  // Boot: who does the stored token belong to?
  useEffect(() => {
    if (!tokens.access) return

    authApi
      .me()
      .then((current) => {
        if (live.current) adopt(current)
      })
      .catch((error: unknown) => {
        /*
         * Only give up on the session if the server actually refused it. The
         * transport has already tried a refresh and probed /api/health/ by
         * this point, so a failure with no response means the server is
         * down — and discarding the tokens then would force a sign-in that
         * was never necessary.
         */
        const refused =
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          Boolean((error as { response?: unknown }).response)

        if (!refused) {
          // Tokens kept. A distinct state, because 'anonymous' would bounce
          // them to sign-in for no reason and 'loading' would spin forever.
          if (live.current) setStatus('unreachable')
          return
        }

        tokens.clear()
        if (live.current) clear()
      })
  }, [adopt, clear, attempt])

  // A rejected refresh token: the session really is over.
  useEffect(
    () =>
      onSessionExpired((reason) => {
        clear()
        // Two different events wearing one message until now. "Superseded"
        // is not a fault and not an expiry — somebody used this account
        // somewhere else, and the person reading this needs to know that
        // rather than wonder why the system dropped them.
        if (reason === 'superseded') {
          snackbar.warning(
            'Signed in somewhere else',
            'This account was used to sign in on another device or browser, so this session ended. Only one device can be signed in at a time.',
          )
          return
        }
        snackbar.warning(
          'You have been signed out',
          'That sign-in is no longer valid. Please sign in again.',
        )
      }),
    [clear],
  )

  // The server did not answer. The session is untouched — say what happened
  // rather than silently dropping someone at the sign-in screen.
  useEffect(
    () =>
      onServerUnreachable(() => {
        // Confirmed against /api/health/ before this fires, so it is not a
        // guess. The session is untouched — no redirect, nothing cleared.
        snackbar.error(
          'Cannot reach the server',
          'You are still signed in. This will work again once the connection is back.',
        )
      }),
    [],
  )

  const requestCode = useCallback(async (email: string, password: string) => {
    setPending(true)
    setError(null)
    try {
      const issued = await authApi.requestLoginCode({ email, password })
      setChallenge(issued)
      setStatus('challenged')
      snackbar.info('Check your email', `We sent a sign-in code to ${issued.email_hint}.`)
    } catch (cause) {
      setError(toApiError(cause))
    } finally {
      setPending(false)
    }
  }, [])

  const submitCode = useCallback(
    async (code: string) => {
      if (!challenge) return
      setPending(true)
      setError(null)
      try {
        const session = await authApi.verifyLoginCode({
          challenge: challenge.challenge,
          code,
        })
        adopt(session.user)
        snackbar.success(`Signed in as ${fullName(session.user)}`, session.user.role_display)
      } catch (cause) {
        setError(toApiError(cause))
      } finally {
        setPending(false)
      }
    },
    [challenge, adopt],
  )

  const restart = useCallback(() => {
    setChallenge(null)
    setError(null)
    setStatus('anonymous')
  }, [])

  const signOut = useCallback(async () => {
    setPending(true)
    try {
      await authApi.logout()
    } finally {
      // Cleared whatever the server said: the user asked to be signed out,
      // and a network hiccup must not leave them holding a live token.
      setPending(false)
      setError(null)
      clear()
      snackbar.success('Signed out')
    }
  }, [clear])

  const refresh = useCallback(async () => {
    const current = await authApi.me()
    adopt(current)
  }, [adopt])

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      challenge,
      error,
      pending,
      requestCode,
      submitCode,
      restart,
      signOut,
      refresh,
      retry,
    }),
    [
      status,
      user,
      challenge,
      error,
      pending,
      requestCode,
      submitCode,
      restart,
      signOut,
      refresh,
      retry,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
