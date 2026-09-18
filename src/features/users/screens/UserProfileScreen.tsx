/**
 * One person's account — what it is, and the four things a lead can do to it.
 *
 * Every one of these already existed on the server and none had a screen, so
 * a forgotten password meant somebody editing the database by hand. That is
 * the gap this fills, and it is why "Set a new password" is the first action
 * rather than the last.
 *
 * ---------------------------------------------------------------------------
 * The four actions, in the order they are usually wanted
 * ---------------------------------------------------------------------------
 *
 *   **Set a new password** — they have forgotten it. Shown once, never
 *   emailed, and it signs them out everywhere.
 *   **Sign out everywhere** — a laptop left open somewhere. The password is
 *   still trusted, only the sessions are the problem.
 *   **Deactivate** — they have left. Never a delete: past receipts, picks
 *   and adjustments name them, and an account that vanishes takes the
 *   audit trail with it.
 *   **Edit** — a typo in a name, a move to another warehouse, a change of
 *   role.
 *
 * All four are confirmed through the shared `ConfirmButton`, because all
 * four are things somebody else finds out about when they cannot sign in.
 *
 * ---------------------------------------------------------------------------
 * Role and site move together
 * ---------------------------------------------------------------------------
 * A warehouse clerk needs a warehouse and a school clerk a school; the two
 * leads and Finance take neither, and the server refuses any other
 * combination. So changing the role clears the site, and the site field is
 * only drawn when the chosen role has one — the same rule the Add User
 * wizard follows.
 */

import { useState } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, KeyRound, LogOut } from 'lucide-react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ConfirmButton,
  LoadingScreen,
  Modal,
  Panel,
  Select,
  TextField,
} from '@/components'
import { toApiError } from '@/api/errors'
import { fullName, initials, roleTone } from '@/domain/access'
import { formatDateTime, formatDay } from '@/domain/dates'
import { AppShell } from '@/features/shell/components/AppShell'
import { useRoles } from '../hooks/useRoles'
import {
  useSetActive,
  useSetPassword,
  useSignOutEverywhere,
  useUpdateUser,
  useUser,
} from '../hooks/useUserAdmin'
import { useWarehouseOptions } from '@/features/catalog/hooks/useWarehouseOptions'
import { useQuery } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import type { RoleInfo, UserAdmin } from '@/api/types'

/**
 * Dates a person chose — the day an account was created.
 */
function when(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  return formatDay(iso.slice(0, 10))
}

/**
 * Moments something happened, with the time.
 *
 * `when()` sliced the first ten characters off and dropped the clock, so
 * "Last signed in 16 Sep" could not tell a lead whether that was this
 * morning or an hour ago. On a shared warehouse machine that is exactly
 * the question being asked.
 */
function at(iso: string | null | undefined): string {
  return formatDateTime(iso)
}

export function UserProfileScreen() {
  const { userId } = useParams()
  const id = Number(userId)

  const user = useUser(id)
  const rolesQuery = useRoles()
  const update = useUpdateUser(id)
  const setPassword = useSetPassword(id)
  const setActive = useSetActive(id)
  const signOut = useSignOutEverywhere(id)

  // Two of these behave differently on your own account and the difference is
  // not guessable: the server refuses a self-deactivation outright (a lead who
  // locks themselves out needs another lead to undo it), while "sign out
  // everywhere" succeeds and drops the session you are reading this in.
  const { user: signedIn } = useAuth()
  const isSelf = signedIn?.id === id

  const [editing, setEditing] = useState(false)
  const [issued, setIssued] = useState<string | null>(null)

  const roles = rolesQuery.data ?? []

  if (user.isLoading) return <LoadingScreen message="Loading the account" />

  if (user.isError || !user.data) {
    return (
      <AppShell title="Users & Roles">
        <Alert tone="error">
          This account could not be loaded. It may have been removed, or the
          server is unreachable.
        </Alert>
      </AppShell>
    )
  }

  const person = user.data
  const name = fullName(person)
  const site = person.warehouse_name || person.school_name
  const needsSite = person.role === 'WAREHOUSE_STAFF' || person.role === 'SCHOOL_STAFF'

  return (
    <AppShell title="Users & Roles">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/users">Users &amp; Roles</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">{name}</span>
      </nav>

      {/*
        A face before the facts. Every other place a person appears in this
        system draws them with an `Avatar` — the sidebar, the users table —
        and a screen about one person was the only one that did not, which
        made it read as a record rather than somebody.

        Role and site sit up here rather than only in the table below,
        because they are the two things a lead came to check.
      */}
      <header className="profile-hero">
        <Avatar initials={initials(person)} size={64} />

        <div className="profile-hero__identity">
          <div className="profile-hero__name">
            <h1 className="profile-hero__title">{name}</h1>
            {/* Red, not grey. A deactivated account cannot sign in, which is
                a state somebody is looking for when they open this screen —
                grey read as "nothing to see here". */}
            <Badge tone={person.is_active ? 'success' : 'error'}>
              {person.is_active ? 'ACTIVE' : 'INACTIVE'}
            </Badge>
          </div>

          <p className="profile-hero__email">{person.email}</p>

          <div className="profile-hero__tags">
            <Badge tone={roleTone(person.role)}>{person.role_display}</Badge>
            <span
              className={`profile-hero__site${
                needsSite && !site ? ' users__site--missing' : ''
              }`}
            >
              {site ?? (needsSite ? 'No site assigned' : 'All sites')}
            </span>
          </div>
        </div>

        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit details
        </Button>
      </header>

      {!person.is_active && (
        <Alert tone="warning">
          <strong>This account is deactivated.</strong> They cannot sign in.
          Everything they did is untouched and still names them.
        </Alert>
      )}

      {/*
        A site-bound role with no site sees nothing and can do nothing: every
        request it makes is scoped to a site it does not have. Said here as
        well as in the list, because this is the screen where it is fixed.
      */}
      {needsSite && !site && (
        <Alert tone="error">
          <strong>No site is assigned.</strong> A {person.role_display} works at
          one site, and until one is set this account can see nothing. Use Edit
          details to assign one.
        </Alert>
      )}

      {/*
        Side by side, so the page uses the width it has. It was one column of
        full-width cards with the actions as a row of buttons under a mostly
        empty details panel.

        Role and site are not repeated here — they are in the hero above,
        which is where a lead looks for them.
      */}
      <div className="profile-columns">
        <Panel title="Account" subtitle="What this person is, and what they may reach.">
          <dl className="detail-list detail-list--profile">
            <div>
              <dt>Phone</dt>
              <dd>{person.phone_number || '—'}</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>
                {person.must_change_password
                  ? 'Must be changed at next sign-in'
                  : 'Set by them'}
              </dd>
            </div>
            <div>
              <dt>Last signed in</dt>
              <dd>{at(person.last_login)}</dd>
            </div>
            <div>
              <dt>Account created</dt>
              <dd>{when(person.date_joined)}</dd>
            </div>
          </dl>
        </Panel>

      {/*
        The password they were handed, shown once. Kept on the page rather
        than in a snackbar that fades: this is the only moment it exists
        anywhere a person can read it.
      */}
      {issued && (
        <Alert tone="warning">
          <strong>New password for {name}: </strong>
          <code className="wizard__review-value--mono">{issued}</code>
          <br />
          Shown once — pass it to them yourself. It is not emailed and cannot
          be shown again. They were signed out everywhere and must set their
          own password at next sign-in.
        </Alert>
      )}

      {setPassword.isError && (
        <Alert tone="error">
          <strong>The password was not changed.</strong>{' '}
          {toApiError(setPassword.error).message}
        </Alert>
      )}

      <Panel
        title="Actions"
        subtitle="Each of these is noticed by the person it happens to."
      >
        <div className="user-actions">
          <ConfirmButton
            confirmLabel="Yes, set a new password"
            title={`Set a new password for ${name}`}
            pendingLabel="Setting…"
            pending={setPassword.isPending}
            note={`A new password is generated and shown to you once — it is never emailed, so you pass it on yourself. ${name} is signed out on every device and must choose their own password at next sign-in.`}
            onConfirm={() =>
              setPassword.mutate(undefined, {
                onSuccess: (result) => setIssued(result.password),
              })
            }
          >
            <KeyRound size={16} aria-hidden />
            Set a new password
          </ConfirmButton>

          <ConfirmButton
            variant="secondary"
            confirmLabel="Yes, sign them out"
            title={`Sign ${name} out everywhere`}
            pendingLabel="Signing out…"
            pending={signOut.isPending}
            note={
              isSelf
                ? 'This is your own account, so this signs you out too — including this tab. Your password is unchanged and you can sign straight back in.'
                : 'Drops every device they are signed in on. Their password is unchanged, so they can sign straight back in — use this for a machine left open, not for an account you no longer trust.'
            }
            onConfirm={() => signOut.mutate()}
          >
            <LogOut size={16} aria-hidden />
            Sign out everywhere
          </ConfirmButton>

          <ConfirmButton
            variant={person.is_active ? 'danger-outline' : 'secondary'}
            confirmLabel={person.is_active ? 'Yes, deactivate' : 'Yes, reactivate'}
            title={`${person.is_active ? 'Deactivate' : 'Reactivate'} ${name}`}
            pending={setActive.isPending}
            note={
              person.is_active
                ? 'They can no longer sign in. Nothing they have done is removed — receipts, picks and adjustments still name them, which is why an account is deactivated and never deleted.'
                : 'They can sign in again with the password they had.'
            }
            onConfirm={() => setActive.mutate(!person.is_active)}
          >
            {person.is_active ? 'Deactivate account' : 'Reactivate account'}
          </ConfirmButton>
        </div>
      </Panel>
      </div>

      {editing && (
        <EditDetails
          person={person}
          roles={roles}
          pending={update.isPending}
          error={update.error ? toApiError(update.error).message : null}
          onClose={() => setEditing(false)}
          onSave={(patch) =>
            update.mutate(patch, { onSuccess: () => setEditing(false) })
          }
        />
      )}
    </AppShell>
  )
}

interface EditDetailsProps {
  /* The API's own types rather than inferred query shapes, which carry an
     `undefined` this component is only ever rendered past. */
  person: UserAdmin
  roles: RoleInfo[]
  pending: boolean
  error: string | null
  onClose: () => void
  onSave: (patch: Partial<UserAdmin>) => void
}

function EditDetails({ person, roles, pending, error, onClose, onSave }: EditDetailsProps) {
  const [firstName, setFirstName] = useState(person.first_name ?? '')
  const [lastName, setLastName] = useState(person.last_name ?? '')
  const [email, setEmail] = useState(person.email)
  const [phone, setPhone] = useState(person.phone_number ?? '')
  const [role, setRole] = useState<string>(person.role)
  const [siteId, setSiteId] = useState<string>(
    String(person.warehouse ?? person.school ?? ''),
  )

  const chosen = roles.find((entry) => entry.value === role) ?? null
  const siteKind = chosen?.requires_site ?? null

  const { warehouses } = useWarehouseOptions()
  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => catalogApi.schools(),
    enabled: siteKind === 'school',
  })

  const sites =
    siteKind === 'warehouse' ? warehouses : siteKind === 'school' ? (schools?.results ?? []) : []

  const ready =
    firstName.trim() && lastName.trim() && email.trim() && (!siteKind || siteId)

  return (
    <Modal
      open
      size="md"
      title="Edit details"
      subtitle={person.email}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={!ready || pending}
            onClick={() =>
              onSave({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.trim(),
                phone_number: phone.trim(),
                role: role as UserAdmin['role'],
                // Exactly one of these, and null for the other — the server
                // refuses a warehouse on a school role and vice versa.
                warehouse: siteKind === 'warehouse' && siteId ? Number(siteId) : null,
                school: siteKind === 'school' && siteId ? Number(siteId) : null,
              })
            }
          >
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="error">
          <strong>Nothing was saved.</strong> {error}
        </Alert>
      )}

      <div className="wizard__grid">
        <TextField
          label="First Name"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
        <TextField
          label="Last Name"
          required
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
      </div>

      <TextField
        label="Email Address"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <TextField
        label="Phone Number"
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />

      <Select
        label="Role"
        value={role}
        onChange={(event) => {
          setRole(event.target.value)
          // The old site belongs to the old role, and the server refuses a
          // warehouse on a school role.
          setSiteId('')
        }}
      >
        {roles.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </Select>

      {siteKind && (
        <Select
          label="Assigned Site"
          required
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
        >
          <option value="" disabled>
            Select a {siteKind}
          </option>
          {sites.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </Select>
      )}
    </Modal>
  )
}
