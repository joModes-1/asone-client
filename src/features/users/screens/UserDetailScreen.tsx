/**
 * One account's detail screen — reached from a Users row.
 *
 * A banner (avatar, name, contact line, status, role) over two info cards,
 * in the shape of a profile page rather than a table row stretched out.
 * AsOne has no student roster, no courses, no attendance — those belong to
 * a different kind of system entirely. What is real here is what
 * `UserAdmin` actually carries: contact details, role and site, and the
 * account's own state (active, must change password, last signed in).
 *
 * "Reset Password" and "Deactivate/Activate" both act immediately through
 * the same mutations the table's status dropdown uses, so the two surfaces
 * can never show a different answer for the same account.
 */

import { useState } from 'react'
import { Mail, Phone, MapPin, KeyRound, Pencil, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, LoadingScreen } from '@/components'
import { paths } from '@/routes/paths'
import { AppShell } from '@/features/shell/components/AppShell'
import { EditUserModal } from '../components/EditUserModal'
import { StatusDropdown } from '../components/StatusDropdown'
import { useActivateUser, useDeactivateUser, useUser } from '../hooks/useUsers'
import * as usersApi from '@/api/users'
import type { UserAdmin } from '@/api/types'

function initialsFor(user: UserAdmin): string {
  const first = user.first_name?.[0] ?? ''
  const last = user.last_name?.[0] ?? ''
  const both = `${first}${last}`.toUpperCase()
  return both || (user.email[0]?.toUpperCase() ?? '')
}

function siteFor(user: UserAdmin): string {
  return user.warehouse_name || user.school_name || 'All Sites'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function UserDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const userId = Number(id)
  const [resetPassword, setResetPassword] = useState<{ password: string } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [editing, setEditing] = useState(false)

  const { data: user, isLoading } = useUser(userId)
  const activateUser = useActivateUser()
  const deactivateUser = useDeactivateUser()

  if (isLoading) return <LoadingScreen message="Loading account…" />
  if (!user) return <LoadingScreen message="Account not found." />

  async function handleResetPassword() {
    setResetting(true)
    try {
      const result = await usersApi.setPassword(user!.id)
      setResetPassword({ password: result.password })
    } finally {
      setResetting(false)
    }
  }

  return (
    <AppShell title={`${user.first_name} ${user.last_name}`.trim() || user.email}>
      <p className="page-head__eyebrow">
        <Link to={paths.users}>USERS &amp; ROLES</Link> / {(user.first_name || user.email).toUpperCase()}
      </p>

      <div className="user-banner">
        <span className="user-banner__avatar">{initialsFor(user)}</span>
        <div className="user-banner__info">
          <h1 className="user-banner__name">
            {`${user.first_name} ${user.last_name}`.trim() || user.email}
          </h1>
          <div className="user-banner__meta">
            <span>
              <Mail size={14} aria-hidden /> {user.email}
            </span>
            {user.phone_number && (
              <span>
                <Phone size={14} aria-hidden /> {user.phone_number}
              </span>
            )}
            <span>
              <MapPin size={14} aria-hidden /> {siteFor(user)}
            </span>
          </div>
          <div className="user-banner__badges">
            <StatusDropdown
              isActive={user.is_active ?? true}
              pending={activateUser.isPending || deactivateUser.isPending}
              onActivate={() => activateUser.mutate(user.id)}
              onDeactivate={() => deactivateUser.mutate(user.id)}
            />
            <Badge tone="info">{user.role_display}</Badge>
          </div>
        </div>
        <div className="user-banner__actions">
          <Button variant="inverse" onClick={() => setEditing(true)}>
            <Pencil size={16} aria-hidden />
            Edit Profile
          </Button>
          <Button variant="inverse" onClick={() => void handleResetPassword()} disabled={resetting}>
            <KeyRound size={16} aria-hidden />
            {resetting ? 'Resetting…' : 'Reset Password'}
          </Button>
        </div>
      </div>

      {editing && <EditUserModal user={user} onClose={() => setEditing(false)} />}

      {resetPassword && (
        <div className="handoff">
          <p className="handoff__lead">New one-time password — shown once</p>
          <code className="handoff__password">{resetPassword.password}</code>
          <p className="handoff__warning">
            <ShieldCheck size={18} aria-hidden />
            Pass this to {user.first_name} yourself — it is not emailed. Every device they were
            signed in on has been signed out. This cannot be shown again.
          </p>
          <Button variant="secondary" onClick={() => setResetPassword(null)}>
            Done
          </Button>
        </div>
      )}

      <h2 className="user-detail-heading">Overview</h2>

      <div className="user-detail-grid">
        <div className="panel">
          <header className="panel__head">
            <h2 className="panel__title">Contact Info</h2>
          </header>
          <div className="panel__body user-detail-fields">
            <div className="user-detail-field">
              <span className="user-detail-field__label">Full Name</span>
              <span className="user-detail-field__value">
                {`${user.first_name} ${user.last_name}`.trim() || '—'}
              </span>
            </div>
            <div className="user-detail-field">
              <span className="user-detail-field__label">Email</span>
              <span className="user-detail-field__value">{user.email}</span>
            </div>
            <div className="user-detail-field">
              <span className="user-detail-field__label">Phone</span>
              <span className="user-detail-field__value">{user.phone_number || '—'}</span>
            </div>
            <div className="user-detail-field">
              <span className="user-detail-field__label">Assigned Site</span>
              <span className="user-detail-field__value">{siteFor(user)}</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <header className="panel__head">
            <h2 className="panel__title">Account &amp; Login</h2>
          </header>
          <div className="panel__body user-detail-fields">
            <div className="user-detail-field">
              <span className="user-detail-field__label">Role</span>
              <span className="user-detail-field__value">{user.role_display}</span>
            </div>
            <div className="user-detail-field">
              <span className="user-detail-field__label">Status</span>
              <span className="user-detail-field__value">
                {user.is_active ?? true ? 'Active' : 'Deactivated'}
              </span>
            </div>
            <div className="user-detail-field">
              <span className="user-detail-field__label">Password</span>
              <span className="user-detail-field__value">
                {user.must_change_password ? 'Must be changed at next sign-in' : 'Set by the owner'}
              </span>
            </div>
            <div className="user-detail-field">
              <span className="user-detail-field__label">Last Signed In</span>
              <span className="user-detail-field__value">{formatDate(user.last_login)}</span>
            </div>
            <div className="user-detail-field">
              <span className="user-detail-field__label">Account Created</span>
              <span className="user-detail-field__value">{formatDate(user.date_joined)}</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
