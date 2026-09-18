/**
 * Create Account — two states, one route.
 *
 * 1. The form: first name, last name, email, phone.
 * 2. Submitted: confirmation that a lead's review is next. Credentials
 *    follow by email once a lead approves and assigns a role — the same
 *    confirmation `POST /auth/users/` sends today.
 *
 * ---------------------------------------------------------------------------
 * There is no "verify your email" step
 * ---------------------------------------------------------------------------
 * There used to be: submitting emailed a six-digit code the registrant typed
 * back, and until they did, no lead could see the request. Removed 15
 * September 2026 at ERA 92's request.
 *
 * It was doing less than it looked like. A lead approves every request by
 * hand and nothing exists until one does, and approval emails that address
 * the account's own credentials — so an address nobody holds fails there,
 * before anyone can sign in. Meanwhile a code in a spam folder left a
 * request nobody could see and nobody could resend.
 *
 * See `accounts.services.request_registration`.
 */

import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import * as authApi from '@/api/auth'
import { toApiError, type ApiError } from '@/api/errors'
import type { RegistrationRequest } from '@/api/types'
import { BrandMark, Button, LoadingScreen, ServerUnreachable } from '@/components'
import { paths } from '@/routes/paths'
import { CreateAccountForm } from '../components/CreateAccountForm'
import { SplitAuthLayout } from '../components/SplitAuthLayout'
import { useAuth } from '../hooks/useAuth'

export function CreateAccountScreen() {
  const { status, retry } = useAuth()
  const [registration, setRegistration] = useState<RegistrationRequest | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [pending, setPending] = useState(false)

  if (status === 'loading') return <LoadingScreen message="Checking your session…" />
  if (status === 'unreachable') return <ServerUnreachable onRetry={retry} />
  if (status === 'signedIn' || status === 'gated') {
    return <Navigate to={paths.dashboard} replace />
  }

  async function handleRequest(input: Parameters<typeof authApi.requestAccount>[0]) {
    setPending(true)
    setError(null)
    try {
      const created = await authApi.requestAccount(input)
      setRegistration(created)
      // Nothing to verify — the request is already in front of the leads.
      setSubmitted(true)
    } catch (cause) {
      setError(toApiError(cause))
    } finally {
      setPending(false)
    }
  }


  if (submitted && registration) {
    return (
      <SplitAuthLayout>
        <div className="auth-card">
          <h1 className="auth-card__title">Request submitted</h1>
          <p className="auth-card__body">
            AsOne's team will review your request and assign you a role. You'll
            hear from them at <strong>{registration.email}</strong> once that's
            done — that message carries your sign-in details, so check it is an
            address you can read.
          </p>
          <Button onClick={() => (window.location.href = paths.signIn)}>Back to sign in</Button>
        </div>
      </SplitAuthLayout>
    )
  }

  return (
    <SplitAuthLayout>
      <header className="signin__head">
        <BrandMark width={80} label="AsOne" />
        <h1 className="signin__title">Create Your Account</h1>
        <p className="signin__subtitle">Join the unified uniform management network</p>
      </header>

      <CreateAccountForm onSubmit={handleRequest} pending={pending} error={error} />
    </SplitAuthLayout>
  )
}
