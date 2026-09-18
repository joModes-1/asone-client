/**
 * Users & Roles.
 *
 * Three tabs — Users, Roles, Permissions — sharing one page head and one
 * "+ Add User" action. Gated on `table_updates`, same as the nav entry: only
 * Program Lead and Operations Manager reach this screen at all, so there is
 * no further per-control hiding here.
 *
 * Pending registration requests are not a separate tab. They show as extra
 * rows at the top of the Users tab — "No Role", "Pending" — because someone
 * asking to join the Users list belongs in the Users list, not filed
 * somewhere else. Clicking one, the same as clicking a `registrations_pending`
 * row on the dashboard's Needs Attention or the notification bell, opens
 * `RegistrationReviewModal` for that specific person.
 *
 * `?review=<id>` opens that dialog directly on load — what a Needs
 * Attention or bell click navigates to, so approving one request is one
 * click away from where it was raised, not a second search through a list.
 */

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Pagination,
  Panel,
  SkeletonRows,
  TabBar,
  snackbar,
} from '@/components'
import { AppShell } from '@/features/shell/components/AppShell'
import { AddUserModal } from '../components/AddUserModal'
import { PermissionsMatrix } from '../components/PermissionsMatrix'
import { RegistrationReviewModal } from '../components/RegistrationReviewModal'
import { UsersTable } from '../components/UsersTable'
import { usePendingRegistrations } from '../hooks/useRegistrationRequests'
import { useRoles } from '../hooks/useRoles'
import { USERS_PAGE_SIZE, useCreateUser, useUsers } from '../hooks/useUsers'
import type { RegistrationRequest } from '@/api/types'

const TABS = [
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles' },
  { key: 'permissions', label: 'Permissions' },
] as const
type TabKey = (typeof TABS)[number]['key']

export function UsersRolesScreen() {
  const [params, setParams] = useSearchParams()
  const requestedTab = params.get('tab')
  const tab: TabKey = TABS.some((entry) => entry.key === requestedTab)
    ? (requestedTab as TabKey)
    : 'users'

  const [modalOpen, setModalOpen] = useState(false)
  const [page, setPage] = useState(1)

  const usersQuery = useUsers(page)
  const rolesQuery = useRoles()
  const createUser = useCreateUser()
  const pendingQuery = usePendingRegistrations()

  const users = usersQuery.data?.results ?? []
  const userCount = usersQuery.data?.count ?? 0
  const roles = rolesQuery.data ?? []
  const pending = pendingQuery.data?.results ?? []

  /*
   * Which request is under review lives in the URL, not local state: a
   * Needs Attention or bell click for one specific person already navigates
   * to `?review=<id>`, and a row clicked here sets the same param — so both
   * paths open the identical dialog through one mechanism, and reloading or
   * sharing the link reopens the same review rather than losing it.
   *
   * Latched rather than looked up fresh every render: approving or
   * declining invalidates the pending list, so the matching row is gone by
   * the time the dialog needs to show its result. Once found, the last
   * request is kept until the dialog itself is closed — updating state
   * during render like this (not in an effect) is the documented way to
   * derive state from a prop that can otherwise disappear out from under it.
   */
  const reviewId = params.get('review')
  const [latched, setLatched] = useState<RegistrationRequest | null>(null)
  if (reviewId && String(latched?.id) !== reviewId) {
    const match = pending.find((request) => String(request.id) === reviewId)
    if (match) setLatched(match)
  } else if (!reviewId && latched) {
    setLatched(null)
  }
  const reviewing = reviewId ? latched : null

  function selectTab(key: string) {
    const next = new URLSearchParams(params)
    if (key === 'users') next.delete('tab')
    else next.set('tab', key)
    setParams(next)
  }

  function openReview(request: RegistrationRequest) {
    const next = new URLSearchParams(params)
    next.set('review', String(request.id))
    setParams(next)
  }

  function closeReview() {
    const next = new URLSearchParams(params)
    next.delete('review')
    setParams(next)
  }

  return (
    <AppShell title="Users & Roles" searchHint="name or email">
      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Users & Roles</h1>
          <p className="page-head__subtitle">
            Manage staff accounts, their roles, and what each role may do.
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)}>
          <UserPlus size={16} aria-hidden />
          Add User
        </Button>
      </header>

      <TabBar label="Users & Roles views" active={tab} onSelect={selectTab} tabs={TABS} />

      {/*
        Named where the work is, not only on the dashboard. A request sits
        here until a lead acts on it, and the row it becomes looks much like
        an account — so the count is said out loud above the table rather
        than left to be noticed.

        Pending requests are shown on every page of the table, because they
        are not part of the paged set: they sit above it, and burying them on
        page three would hide the only rows that need a decision.
      */}
      {tab === 'users' && pending.length > 0 && (
        <Alert tone="warning">
          <strong>
            {pending.length === 1
              ? '1 person is waiting for an account.'
              : `${pending.length} people are waiting for an account.`}
          </strong>{' '}
          They appear at the top of the list below — open one to approve it or
          turn it down. Nothing is created until you do.
        </Alert>
      )}

      {tab === 'users' && (
        <div
          className="table-card"
          aria-busy={usersQuery.isFetching || pendingQuery.isFetching || undefined}
        >
          <UsersTable
            users={users}
            pendingRequests={pending}
            loading={usersQuery.isLoading}
            onReviewPending={openReview}
          />

          {userCount > 0 && (
            <div className="table-card__footer">
              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(userCount / USERS_PAGE_SIZE))}
                totalItems={userCount}
                pageSize={USERS_PAGE_SIZE}
                onChange={setPage}
                noun="accounts"
              />
            </div>
          )}
        </div>
      )}

      {/*
        Roles and Permissions used to render the identical matrix, so two
        tabs showed one view and clicking between them did nothing. They
        answer different questions and now show different things: Roles is
        the five roles and what each one is *for*; Permissions is the grid of
        which function each may reach.
      */}
      {tab === 'roles' && (
        <Panel title="Roles" subtitle="The five roles AsOne's access matrix defines.">
          {rolesQuery.isLoading ? (
            <SkeletonRows rows={5} />
          ) : (
            <ul className="role-list">
              {roles.map((role) => (
                <li key={role.value} className="role-list__item">
                  <div className="role-list__head">
                    <h3 className="role-list__name">{role.label}</h3>
                    <Badge tone={role.requires_site ? 'info' : 'neutral'}>
                      {role.requires_site
                        ? `Assigned to one ${role.requires_site}`
                        : 'All locations'}
                    </Badge>
                  </div>
                  <p className="role-list__summary">{role.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'permissions' && (
        <Panel
          title="Role Permissions Matrix"
          subtitle="Which system functions each role may reach."
        >
          <PermissionsMatrix roles={roles} loading={rolesQuery.isLoading} />
        </Panel>
      )}

      {modalOpen && (
        <AddUserModal
          roles={roles}
          onClose={() => setModalOpen(false)}
          onCreate={async (input) => {
            const created = await createUser.mutateAsync(input)
            /*
              The shared snackbar, not a hand-rolled banner on a four-second
              timer. Every other confirmation in the app arrives this way,
              and this one used to be a `div` that pushed the table down and
              then let it jump back up.
            */
            snackbar.success(
              `${input.first_name} ${input.last_name} added`,
              `Signs in as ${input.email}. They must set their own password first.`,
            )
            return created
          }}
        />
      )}

      {reviewing && (
        <RegistrationReviewModal request={reviewing} roles={roles} onClose={closeReview} />
      )}
    </AppShell>
  )
}
