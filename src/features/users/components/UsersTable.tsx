/**
 * The Users tab's table — Name, Email, Role, Assigned Site, Status, Last Active.
 *
 * "Last Active" reads `last_login`, which is the closest thing the server
 * tracks — there is no separate presence/activity feed, so this is a sign-in
 * timestamp shown under a friendlier label, not a live "seen 2 minutes ago".
 *
 * A real user's row opens their detail screen — the same account, with more
 * room than a table cell has. Status is its own control rather than part of
 * that click target: it is a dropdown offering both Active and Deactivate
 * regardless of the account's current state, so choosing one there acts
 * immediately without leaving the table for the detail screen first.
 *
 * `pendingRequests` are not users — nobody has assigned them a role yet, so
 * there is no account to list, and no detail screen to open. They appear
 * here anyway rather than on a separate screen, because "somebody asking to
 * join the Users list" belongs in the Users list: Role reads "No Role" and
 * Status reads "Pending", clicking either opens the same Approve/Decline
 * review a Needs Attention click does.
 */

import { useNavigate } from 'react-router-dom'
import { Users as UsersIcon } from 'lucide-react'
import { Badge, EmptyState, SkeletonRows } from '@/components'
import { paths } from '@/routes/paths'
import { useActivateUser, useDeactivateUser } from '../hooks/useUsers'
import { StatusDropdown } from './StatusDropdown'
import type { RegistrationRequest, UserAdmin } from '@/api/types'

interface UsersTableProps {
  users: UserAdmin[]
  pendingRequests?: RegistrationRequest[]
  loading: boolean
  onReviewPending?: (request: RegistrationRequest) => void
}

function siteFor(user: UserAdmin): string {
  return user.warehouse_name || user.school_name || 'All Sites'
}

/** Relative-ish, matching the design's "2 mins ago" / "3 days ago" style. */
function lastActive(iso: string | null): string {
  if (!iso) return 'Never signed in'

  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function UsersTable({ users, pendingRequests = [], loading, onReviewPending }: UsersTableProps) {
  const navigate = useNavigate()
  const activateUser = useActivateUser()
  const deactivateUser = useDeactivateUser()

  if (loading) return <SkeletonRows rows={8} height="44px" />

  if (users.length === 0 && pendingRequests.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No users yet"
        body="Add the first staff account with the button above."
      />
    )
  }

  return (
    <div className="scroll-x">
      <table className="ledger">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Assigned Site</th>
            <th>Status</th>
            <th>Last Active</th>
          </tr>
        </thead>
        <tbody>
          {pendingRequests.map((request) => (
            <tr
              key={`pending-${request.id}`}
              className="ledger__row--clickable"
              role="button"
              tabIndex={0}
              onClick={() => onReviewPending?.(request)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onReviewPending?.(request)
                }
              }}
            >
              <td className="ledger__strong">
                {request.first_name} {request.last_name}
              </td>
              <td>{request.email}</td>
              <td>
                <Badge tone="neutral">No Role</Badge>
              </td>
              <td>—</td>
              <td>
                <span className="status-dot status-dot--pending">
                  <span className="status-dot__mark" aria-hidden />
                  Pending
                </span>
              </td>
              <td>Requested {new Date(request.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {users.map((user) => (
            <tr
              key={user.id}
              className="ledger__row--clickable"
              onClick={() => navigate(paths.userDetail(user.id))}
            >
              <td className="ledger__strong">
                {`${user.first_name} ${user.last_name}`.trim() || user.email}
              </td>
              <td>{user.email}</td>
              <td>
                <Badge tone="info">{user.role_display}</Badge>
              </td>
              <td>{siteFor(user)}</td>
              <td onClick={(event) => event.stopPropagation()}>
                <StatusDropdown
                  isActive={user.is_active ?? true}
                  pending={activateUser.isPending || deactivateUser.isPending}
                  onActivate={() => activateUser.mutate(user.id)}
                  onDeactivate={() => deactivateUser.mutate(user.id)}
                />
              </td>
              <td>{lastActive(user.last_login)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
