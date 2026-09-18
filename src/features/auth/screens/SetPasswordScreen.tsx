/**
 * Replace the password you were handed — the gate between signing in and
 * using the system.
 *
 * ---------------------------------------------------------------------------
 * Why this screen had to exist
 * ---------------------------------------------------------------------------
 * The server refuses **every** request from an account with
 * `must_change_password` set, with `403 "Set a new password before using the
 * system."` Every account starts that way: a lead creates one, hands over a
 * password they also know, and the account is not that person's until they
 * replace it.
 *
 * The client knew this — `AuthProvider` has computed a `gated` status since
 * the beginning — and then let a gated user straight into the dashboard,
 * where all fourteen requests 403'd. What they saw was "Your dashboard could
 * not be loaded", an empty sidebar, and no way forward. It looked like a
 * broken account rather than one step they had not taken; the account was
 * fine and nothing told them what to do.
 *
 * So `RequireAuth` now sends a gated user here, and this screen is the only
 * thing they can reach until the gate clears.
 *
 * ---------------------------------------------------------------------------
 * It does not ask for the current password
 * ---------------------------------------------------------------------------
 * `/auth/password/change/` normally requires it, so that a stolen access
 * token alone cannot lock the owner out of their own account. This screen is
 * the one place that reasoning does not hold, and the server makes the field
 * optional for exactly this state:
 *
 *   * The one-time password was typed on the sign-in form seconds ago.
 *     There is no other way to have got here, so asking again is asking the
 *     same question twice in a row.
 *   * The gate blocks every other endpoint, so a session in the wrong hands
 *     can do one thing — set a password. The field would only stop somebody
 *     reaching an unlocked screen inside that window.
 *   * It stops nothing at all with respect to the lead who set the account
 *     up: they chose the one-time password and could sign in directly.
 *
 * So it costs a retype at the moment a new user is least sure of themselves
 * and buys close to nothing. Two fields: the new password, and it again.
 *
 * The response carries a fresh token pair, which `api/auth.changePassword`
 * stores — the old ones are blacklisted server-side the moment the password
 * changes, so without that the user is signed out the instant they succeed.
 */

import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import * as authApi from '@/api/auth'
import { toApiError, type ApiError } from '@/api/errors'
import { Alert, BrandMark, Button, LoadingScreen, PasswordField, ServerUnreachable } from '@/components'
import { paths } from '@/routes/paths'
import { SplitAuthLayout } from '../components/SplitAuthLayout'
import { useAuth } from '../hooks/useAuth'

export function SetPasswordScreen() {
  const { status, user, refresh, retry } = useAuth()

  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)

  if (status === 'loading') return <LoadingScreen message="Checking your session…" />
  if (status === 'unreachable') return <ServerUnreachable onRetry={retry} />
  if (status === 'anonymous' || status === 'challenged') {
    return <Navigate to={paths.signIn} replace />
  }
  // The gate is clear — either it never applied or it has just been cleared.
  if (status === 'signedIn') return <Navigate to={paths.dashboard} replace />

  const mismatch = confirm !== '' && next !== confirm
  const ready = next.trim() && next === confirm && !pending

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return

    setPending(true)
    setError(null)
    try {
      await authApi.changePassword({ new_password: next })
      // Re-reads the user, which flips `gated` to `signedIn` and lets the
      // redirect above take them in.
      await refresh()
    } catch (cause) {
      setError(toApiError(cause))
      setPending(false)
    }
  }

  return (
    <SplitAuthLayout>
      <header className="signin__head">
        <BrandMark width={80} label="AsOne" />
        <h1 className="signin__title">Choose your password</h1>
        <p className="signin__subtitle">
          One step before you start. The password you were given is known to
          whoever set up your account — this one is yours alone.
        </p>
      </header>

      <form className="signin__form" onSubmit={handleSubmit} noValidate>
        {error && !error.fields && (
          <Alert tone="error">
            <strong>That did not work.</strong> {error.message}
          </Alert>
        )}

        <PasswordField
          label="New password"
          autoComplete="new-password"
          required
          autoFocus
          value={next}
          error={error?.fields?.new_password?.[0]}
          onChange={(event) => setNext(event.target.value)}
        />

        <PasswordField
          label="Repeat new password"
          autoComplete="new-password"
          required
          value={confirm}
          /* Caught here rather than by the server, which is only sent one of
             them and so could never tell them apart. */
          error={mismatch ? 'The two passwords do not match.' : undefined}
          onChange={(event) => setConfirm(event.target.value)}
        />

        <Button type="submit" size="lg" full disabled={!ready}>
          {pending ? 'Saving…' : 'Save and continue'}
        </Button>

        {user && (
          <p className="signin__subtitle">
            Signed in as {user.email}. Not you?{' '}
            <a href={paths.signIn}>Sign in as somebody else</a>.
          </p>
        )}
      </form>
    </SplitAuthLayout>
  )
}
