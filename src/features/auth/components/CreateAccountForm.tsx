/**
 * The create-account form.
 *
 * Presentational, like `SignInForm`: collects the three fields the design
 * calls for and hands them up. Does not call the API and does not decide
 * what happens on success.
 */

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, TextField } from '@/components'
import { paths } from '@/routes/paths'
import type { ApiError } from '@/api/errors'
import type { AccountRequest } from '@/api/types'

interface CreateAccountFormProps {
  onSubmit: (input: AccountRequest) => void
  pending: boolean
  error: ApiError | null
}

export function CreateAccountForm({ onSubmit, pending, error }: CreateAccountFormProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [agreed, setAgreed] = useState(false)

  const fieldError = (name: string) => error?.fields?.[name]?.[0]
  const complete =
    firstName.trim() && lastName.trim() && email.trim() && phoneNumber.trim() && agreed

  /*
    Two fields, because the server stores two.

    This was one "Full Name" box split on the first space, which guessed
    wrong in both directions: "Mary Claire Nakato" put two of her names in
    `last_name`, and a single word was copied into *both* fields — the server
    requires each to be non-blank, so somebody called Joan was stored as
    "Joan Joan" and appeared that way in every list a lead reads. Asking is
    cheaper than guessing, and it is one extra field on a form filled in
    once.
  */
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!complete) return

    onSubmit({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone_number: phoneNumber.trim(),
    })
  }

  return (
    <form className="signin__form" onSubmit={handleSubmit} noValidate>
      {error && !error.fields && <Alert tone="error">{error.message}</Alert>}

      <div className="signin__row">
        <TextField
          label="First Name"
          autoComplete="given-name"
          required
          autoFocus
          value={firstName}
          error={fieldError('first_name')}
          onChange={(event) => setFirstName(event.target.value)}
        />
        <TextField
          label="Last Name"
          autoComplete="family-name"
          required
          value={lastName}
          error={fieldError('last_name')}
          onChange={(event) => setLastName(event.target.value)}
        />
      </div>

      <TextField
        label="Email Address"
        type="email"
        autoComplete="email"
        required
        value={email}
        error={fieldError('email')}
        onChange={(event) => setEmail(event.target.value)}
      />

      <TextField
        label="Phone Number"
        type="tel"
        autoComplete="tel"
        required
        value={phoneNumber}
        error={fieldError('phone_number')}
        onChange={(event) => setPhoneNumber(event.target.value)}
      />

      <label className="signin__agree">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span>
          I agree to the <a href="#terms">Terms of Service</a> and{' '}
          <a href="#privacy">Privacy Policy</a>
        </span>
      </label>

      <div className="signin__actions signin__actions--compact">
        <Button type="submit" size="lg" full disabled={!complete || pending}>
          {pending ? 'Creating account…' : 'Create Account'}
        </Button>
      </div>

      <p className="signin__request">
        Already have an account?{' '}
        <Link className="link-accent" to={paths.signIn}>
          Sign In
        </Link>
      </p>
    </form>
  )
}
