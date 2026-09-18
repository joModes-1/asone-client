/**
 * The HTTP transport. Everything in `api/` goes through here.
 *
 * This module knows about tokens and status codes. It does not know about
 * React, routing or screens: when the session dies it *announces* that and
 * lets the app decide where to send the user. An interceptor that calls
 * `window.location.href = '/login'` cannot be tested without a browser, and
 * throws away whatever the user had typed.
 *
 * ---------------------------------------------------------------------------
 * The session is cleared in exactly two places
 * ---------------------------------------------------------------------------
 * A `token_invalid` from the server, and a deliberate sign-out. Nothing else
 * — not a network error, not a timeout, not a 500. Each of those means the
 * request did not get an answer, which says nothing about whether the
 * session is good, and guessing "signed out" is how a backend restart turns
 * into everybody having to sign in again.
 */

import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { isServerReachable } from './health'
import { tokens } from './tokens'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

/**
 * Bounded, so a lossy connection fails with a message instead of hanging on
 * "Signing in…" until some unpredictable OS-level timeout fires.
 */
const TIMEOUT_MS = 30_000

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
})

// ---------------------------------------------------------------------------
// Session death, announced rather than acted on
// ---------------------------------------------------------------------------

/**
 * A session ending carries *why*, because two reasons need different words.
 * An ordinary expiry is nobody's doing; being superseded means somebody else
 * signed in to this account, and the person at this keyboard needs telling
 * that rather than a shrug about their session.
 */
export type SessionEndReason = 'expired' | 'superseded'

/** Told why the session ended. */
type SessionListener = (reason: SessionEndReason) => void

/** Told only that the server did not answer — there is no "why" to pass. */
type Listener = () => void

const sessionExpiredListeners = new Set<SessionListener>()
const serverUnreachableListeners = new Set<Listener>()

/**
 * The refresh token was **rejected** — spent, blacklisted or invalid. The one
 * case where somebody genuinely has to sign in again. The auth feature
 * subscribes and handles the redirect; `api/` stays unaware routes exist.
 */
export function onSessionExpired(listener: SessionListener): () => void {
  sessionExpiredListeners.add(listener)
  return () => sessionExpiredListeners.delete(listener)
}

/**
 * The refresh **could not be attempted** — no response, or the server broke.
 *
 * Kept separate because the two need opposite handling, and conflating them
 * was a real bug: a server that was simply down signed the user out and
 * discarded their tokens, so when it came back they had to sign in again for
 * no reason. Nothing about the session was wrong.
 */
export function onServerUnreachable(listener: Listener): () => void {
  serverUnreachableListeners.add(listener)
  return () => serverUnreachableListeners.delete(listener)
}

function announceSessionExpired(reason: SessionEndReason = 'expired'): void {
  tokens.clear()
  for (const listener of sessionExpiredListeners) listener(reason)
}

function announceServerUnreachable(): void {
  // Tokens are deliberately kept. They are probably still valid; the server
  // just did not answer.
  for (const listener of serverUnreachableListeners) listener()
}

/**
 * Why a 401 was returned.
 *
 * The server normalises these deliberately — simplejwt reports an expired
 * token and a forged one both as `token_not_valid` and buries the difference
 * in an English sentence. `code` is the contract; `detail` is prose that may
 * change.
 *
 *   token_expired       routine. Thirty-minute tokens expire all day. Refresh.
 *   token_invalid       never ours, or tampered with. This will never work.
 *   not_authenticated   there was no session to begin with.
 *   session_superseded  somebody signed in to this account somewhere else.
 *                       Retrying and refreshing are both pointless — the
 *                       refresh token was retired at the same instant.
 */
type TokenFailure =
  | 'token_expired'
  | 'token_invalid'
  | 'not_authenticated'
  | 'session_superseded'
  | 'unknown'

const TOKEN_FAILURES = new Set([
  'token_expired',
  'token_invalid',
  'not_authenticated',
  'session_superseded',
])

function tokenFailureOf(error: unknown): TokenFailure {
  if (!axios.isAxiosError(error)) return 'unknown'
  const code = (error.response?.data as { code?: unknown } | undefined)?.code
  return typeof code === 'string' && TOKEN_FAILURES.has(code)
    ? (code as TokenFailure)
    : 'unknown'
}

// ---------------------------------------------------------------------------
// Requests carry the access token
// ---------------------------------------------------------------------------

http.interceptors.request.use((config) => {
  const token = tokens.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ---------------------------------------------------------------------------
// A 401 buys exactly one refresh, shared by every request that saw it
// ---------------------------------------------------------------------------

/**
 * Single-flight refresh.
 *
 * When an access token expires, a screen with six queries on it fails six
 * times at once. Without this guard each failure would fire its own refresh;
 * because the server rotates refresh tokens and blacklists the spent one,
 * the first would succeed and the other five would 401 — signing the user
 * out mid-task. Ten simultaneous 401s must cause exactly one refresh.
 */
let refreshing: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refresh = tokens.refresh
  if (!refresh) throw new Error('No refresh token')

  // Deliberately a bare axios call: routing it through `http` would attach a
  // dead access token and recurse back into this interceptor.
  const { data } = await axios.post<{ access: string; refresh: string }>(
    `${BASE_URL}/auth/refresh/`,
    { refresh },
    { timeout: TIMEOUT_MS },
  )

  tokens.set({ access: data.access, refresh: data.refresh })
  return data.access
}

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean }

/**
 * Endpoints where a 401 means "wrong credentials", not "my token expired".
 * Refreshing in front of them adds a round-trip to an error the user needs
 * to see immediately — a wrong password would look like a hang.
 */
const NO_REFRESH = ['/auth/login/', '/auth/refresh/', '/auth/logout/']

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error

    const original = error.config as Retriable | undefined

    /*
     * No response at all: no status, no body. The browser simply failed.
     *
     * This is the case that gets frontends wrong. Treating it as
     * "unauthorized" throws the session away and shows a login screen, and
     * the user has no idea why. So ask the one question the failed request
     * cannot answer — is the server there? — and only then decide.
     */
    if (!error.response) {
      const reachable = await isServerReachable(BASE_URL)
      if (!reachable) {
        // Down, or no connection. The session is almost certainly fine.
        announceServerUnreachable()
        throw error
      }
      // The server is up, so something else failed this request. Still not a
      // reason to sign anybody out.
      throw error
    }

    const status = error.response.status
    const exempt = NO_REFRESH.some((path) => original?.url?.includes(path))

    // A 403 is a permission decision, not an expired token. Refreshing and
    // retrying would get the same answer, so it goes straight to the caller.
    if (status !== 401 || !original || original._retried || exempt) throw error

    const failure = tokenFailureOf(error)

    /*
     * `token_invalid` will never work again — that is the one and only
     * status that ends a session here. Anything else falls through to a
     * refresh attempt, because a session that might still be good must not
     * be discarded on a guess.
     */
    if (failure === 'token_invalid') {
      announceSessionExpired()
      throw error
    }

    /*
     * Somebody signed in to this account elsewhere. Attempting a refresh
     * would be a wasted round trip that can only fail — the refresh token
     * was retired at the same instant the epoch moved — and would end with
     * the generic "session expired", which is not what happened.
     */
    if (failure === 'session_superseded') {
      announceSessionExpired('superseded')
      throw error
    }

    original._retried = true

    try {
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null
      })
      const access = await refreshing
      original.headers.Authorization = `Bearer ${access}`
      return http(original)
    } catch (refreshError) {
      /*
       * The refresh itself failed. Same question again, and the same rule:
       * only a server that is up and rejecting the refresh token as invalid
       * ends the session. A network failure, a timeout or a 500 leaves the
       * tokens alone — they are probably still good, and the user should be
       * told the server is unreachable, not shown a login screen.
       */
      if (!axios.isAxiosError(refreshError) || !refreshError.response) {
        announceServerUnreachable()
      } else if (tokenFailureOf(refreshError) === 'token_invalid') {
        announceSessionExpired()
      } else if (refreshError.response.status >= 500) {
        announceServerUnreachable()
      } else {
        // A 4xx that is not token_invalid — a spent or blacklisted refresh
        // token. It will not work again either.
        announceSessionExpired()
      }
      throw error
    }
  },
)

// ---------------------------------------------------------------------------
// Verbs
// ---------------------------------------------------------------------------

/**
 * Every backend route requires a trailing slash — Django redirects without
 * one, and a redirected POST arrives without its body. Callers build paths
 * with the slash; this guard catches the ones that forget in development.
 */
function assertTrailingSlash(url: string): void {
  if (import.meta.env.DEV && !url.split('?')[0].endsWith('/')) {
    throw new Error(`API paths need a trailing slash: "${url}"`)
  }
}

export async function get<T>(url: string, params?: QueryParams): Promise<T> {
  assertTrailingSlash(url)
  const { data } = await http.get<T>(url, { params: clean(params) })
  return data
}

export async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  assertTrailingSlash(url)
  const { data } = await http.post<T>(url, body, config)
  return data
}

export async function patch<T>(url: string, body: unknown): Promise<T> {
  assertTrailingSlash(url)
  const { data } = await http.patch<T>(url, body)
  return data
}

export async function del(url: string): Promise<void> {
  assertTrailingSlash(url)
  await http.delete(url)
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>

/**
 * Drop empty filters instead of sending `?warehouse=`, which DRF reads as a
 * filter on the empty string and answers with nothing.
 */
function clean(params?: QueryParams): QueryParams | undefined {
  if (!params) return undefined
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
}
