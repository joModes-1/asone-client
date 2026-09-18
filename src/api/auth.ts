/**
 * Authentication.
 *
 * Signing in is two steps, and neither is optional:
 *
 *   1. `requestLoginCode`  email + password. Emails a one-time code and
 *                          returns a challenge. **No tokens.**
 *   2. `verifyLoginCode`   challenge + code. Returns the token pair and the
 *                          user.
 *
 * A password alone is enough to read every school's orders and every
 * warehouse's stock, which is why the server stopped issuing tokens for one.
 *
 * Thin by design: one request and one type per function. No React, no
 * navigation, no storage decisions beyond handing tokens to `tokens`.
 */

import { get, patch, post } from './http'
import { tokens } from './tokens'
import type {
  AccountRequest,
  Credentials,
  CurrentUser,
  EmailVerification,
  LoginAttempt,
  LoginChallenge,
  Page,
  RegistrationRequest,
  RoleInfo,
  Session,
  VerifyLoginCode,
} from './types'

/**
 * Step one. Checks the password, then emails a code.
 *
 * The failure codes are meaningfully different here and screens should say so:
 *
 *   403  the address is not a user of this system, or has been deactivated,
 *        or its email was never confirmed. Retyping the password will not
 *        help, so say that rather than leaving someone guessing.
 *   401  the address exists; the password is wrong.
 *   429  rate limited, per address and per site.
 */
export function requestLoginCode(credentials: Credentials): Promise<LoginChallenge> {
  return post<LoginChallenge>('/auth/login/', credentials)
}

/**
 * Step two. Exchanges the challenge and code for tokens.
 *
 * A code is good once, for a few minutes, with a limited number of tries.
 * Expired, already used and too-many-attempts all come back as the same 400,
 * deliberately not saying which — so the screen must offer "start again"
 * rather than "try another code".
 *
 * Storing the tokens is this function's job: a caller that forgot would leave
 * the app authenticated in memory only.
 */
export async function verifyLoginCode(input: VerifyLoginCode): Promise<Session> {
  const session = await post<Session>('/auth/login/verify/', input)
  tokens.set({ access: session.access, refresh: session.refresh })
  return session
}

/**
 * A new member of staff confirming the address their account was created
 * against. Open — the caller has no account to authenticate with yet, which
 * is what the code stands in for.
 *
 * Until this is done, signing in is refused with a 403.
 */
export function verifyEmail(input: EmailVerification): Promise<{ detail: string }> {
  return post<{ detail: string }>('/auth/verify-email/', input)
}

/**
 * "Get Started Onboarding" — ask for an account.
 *
 * Open: there is no account yet to authenticate as. Immediately emails a
 * confirmation code — call `confirmRegistration` with it next. Creates
 * nothing more than a pending request; nothing here can be signed into. A
 * Program Lead or Operations Manager reviews it once the address is
 * confirmed, and either approves it (which creates the account and emails
 * a *second*, separate code — the same as `POST /auth/users/` does today)
 * or declines it.
 */
export function requestAccount(input: AccountRequest): Promise<RegistrationRequest> {
  return post<RegistrationRequest>('/auth/register/', input)
}

/**
 * Confirm the code sent the moment `requestAccount` was submitted.
 *
 * Does not create an account and does not sign anyone in — it unlocks the
 * request for a lead to review. Expired, already used and too-many-attempts
 * all come back as the same 400, deliberately not saying which — so the
 * screen must offer "start again" rather than "try another code".
 */
export function confirmRegistration(input: EmailVerification): Promise<{ detail: string }> {
  return post<{ detail: string }>('/auth/register/verify/', input)
}

/**
 * Sign out. Blacklists the refresh token; the access token stays valid until
 * it expires, which is inherent to stateless tokens and why they are short.
 *
 * Clears local tokens even if the request fails — the user asked to be signed
 * out, and leaving a usable token behind because the network hiccuped is the
 * wrong way to fail.
 */
export async function logout(): Promise<void> {
  const refresh = tokens.refresh
  try {
    if (refresh) await post('/auth/logout/', { refresh })
  } finally {
    tokens.clear()
  }
}

/** The signed-in user. Reachable even while the password gate is up. */
export function me(): Promise<CurrentUser> {
  return get<CurrentUser>('/auth/me/')
}

/**
 * Edit your own contact details — the Settings screen.
 *
 * **First name, last name and email only.** Role and site are deliberately
 * not editable here: a person must not be able to promote themselves or move
 * site. Sending either is ignored rather than refused, so do not offer them
 * as fields — a control that silently does nothing is worse than no control.
 *
 * Changing the email changes the address you sign in with. A 400 on `email`
 * means somebody else already has it.
 */
export function updateMe(body: {
  first_name?: string
  last_name?: string
  email?: string
}): Promise<CurrentUser> {
  return patch<CurrentUser>('/auth/me/', body)
}

/**
 * Change your own password.
 *
 * Requires the current password even though you are signed in, so a stolen
 * token alone cannot lock the owner out. Signs out every other session and
 * returns a fresh token pair, stored here for the same reason as sign-in.
 *
 * The one exception is the first-time gate, where the server accepts it
 * without a current password — there the account has just signed in with the
 * one-time password to reach this at all, and can do nothing else until it
 * changes. See `SetPasswordScreen`.
 */
export async function changePassword(input: {
  current_password?: string
  new_password: string
}): Promise<void> {
  const next = await post<Partial<Session>>('/auth/password/change/', input)
  if (next.access && next.refresh) {
    tokens.set({ access: next.access, refresh: next.refresh })
  }
}

/**
 * The five roles and the seven columns of AsOne's access matrix.
 *
 * Blocked while `must_change_password` is true, so a set-a-password screen
 * cannot depend on it.
 */
export function roles(): Promise<RoleInfo[]> {
  return get<RoleInfo[]>('/auth/roles/')
}

/** The sign-in audit trail. Leads only. */
export function loginAttempts(params?: {
  email?: string
  succeeded?: boolean
  user?: number
  page?: number
}): Promise<Page<LoginAttempt>> {
  return get('/auth/login-attempts/', params)
}
