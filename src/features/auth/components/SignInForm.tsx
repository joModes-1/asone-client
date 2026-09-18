/**
 * The sign-in form.
 *
 * Presentational: it collects two fields and hands them up. It does not know
 * what a session is, does not call the API, and does not decide where anyone
 * goes next.
 *
 * Errors split by kind. A 400 names its field, so those messages attach to
 * the inputs. Everything else — a wrong password, a rate limit, an
 * unreachable server — is one sentence above the form, in the server's
 * words. Sign-in answers 401 identically for a wrong password and an unknown
 * address, so nothing here may imply which it was.
 */

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, PasswordField, TextField } from '@/components'
import { paths } from '@/routes/paths'
import type { ApiError } from '@/api/errors'
import type { Credentials } from '@/api/types'

interface SignInFormProps {
  onSubmit: (credentials: Credentials) => void
  pending: boolean
  error: ApiError | null
}

export function SignInForm({ onSubmit, pending, error }: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const fieldError = (name: string) => error?.fields?.[name]?.[0]

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ email, password })
  }

  return (
    <form className="signin__form" onSubmit={handleSubmit} noValidate>
      {error && !error.fields && <Alert tone="error">{error.message}</Alert>}

      {/* Email, not a username — there is no username anywhere in this API. */}
      <TextField
        label="Email Address"
        type="email"
        autoComplete="username"
        required
        autoFocus
        value={email}
        error={fieldError('email')}
        onChange={(event) => setEmail(event.target.value)}
      />

      <PasswordField
        autoComplete="current-password"
        required
        value={password}
        error={fieldError('password')}
        onChange={(event) => setPassword(event.target.value)}
      />

      <div className="signin__forgot">
        {/*
          No recovery endpoint exists — the API has no forgot-password route.
          A lead resets a colleague's password via /auth/users/{id}/set-password/.
          Rendered because the design calls for it; it needs either that
          endpoint or a line telling people who to ask.
        */}
        <a className="link-danger" href="#forgot">
          Forgot password?
        </a>
      </div>

      <div className="signin__actions">
        <Button type="submit" size="lg" full disabled={pending}>
          {pending ? 'Signing in…' : 'Sign In to System'}
        </Button>
      </div>

      <p className="signin__request">
        Don't have an account?{' '}
        <Link className="link-quiet" to={paths.welcome}>
          Request access
        </Link>
      </p>
    </form>
  )
}
