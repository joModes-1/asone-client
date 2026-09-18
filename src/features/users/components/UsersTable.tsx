/**
 * The Users tab's table — Name, Email, Role, Assigned Site, Status, Last Active.
 *
 * "Last Active" reads `last_login`, which is the closest thing the server
 * tracks — there is no separate presence/activity feed, so this is a sign-in
 * timestamp shown under a friendlier label, not a live "seen 2 minutes ago".
 *
 * A real user's row opens their detail screen — the same account, with more
 * room than a table cell has. Activating and deactivating an account happen
 * there, not in this table.
 *
 * `pendingRequests` are not users — nobody has assigned them a role yet, so
 * there is no account to list, and no detail screen to open. They appear
 * here anyway rather than on a separate screen, because "somebody asking to
 * join the Users list" belongs in the Users list: Role reads "No Role" and
 * Status reads "Pending", clicking either opens the same Approve/Decline
 * review a Needs Attention click does.
 */

import { Users as UsersIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, EmptyState, SkeletonRows } from '@/components'
import { formatDay } from '@/domain/dates'
import type { RegistrationRequest, UserAdmin } from '@/api/types'
import { roleTone } from '@/domain/access'

interface UsersTableProps {
  users: UserAdmin[]
  pendingRequests?: RegistrationRequest[]
  loading: boolean
  onReviewPending?: (request: RegistrationRequest) => void
}

/**
 * Where this user works, and whether that is an answer or a gap.
 *
 * "All Sites" is correct for a lead or Finance — the matrix gives them every
 * location, so a blank site is the truth. It is a *fault* for a warehouse or
 * school account: every request they make is scoped to a site they do not
 * have, so they see nothing and can do nothing, and the screen should say so
 * rather than print the same reassuring phrase as a lead.
 *
 * `User.clean()` refuses to save one, but nothing stops `objects.create()`,
 * and two of these exist in the data today.
 */
function siteFor(user: UserAdmin): { label: string; missing: boolean } {
  const site = user.warehouse_name || user.school_name
  if (site) return { label: site, missing: false }

  const needsOne = user.role === 'WAREHOUSE_STAFF' || user.role === 'SCHOOL_STAFF'
  return needsOne
    ? { label: 'No site assigned', missing: true }
    : { label: 'All Sites', missing: false }
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
    <div className="table-scroll">
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
              <td className="ledger__nowrap">
                Requested {formatDay(request.created_at.slice(0, 10))}
              </td>
            </tr>
          ))}
          {users.map((user) => (
            /*
             * The whole row opens the account, matching the pending rows
             * above and every other table in the system. The name stays a
             * real <Link> inside it: the row handler is a convenience for a
             * mouse, and removing the anchor would take away middle-click,
             * open-in-new-tab, the status bar preview and the only thing a
             * keyboard or screen reader can reach.
             */
            <tr
              key={user.id}
              className="ledger__row--clickable"
              onClick={() => navigate(`/users/${user.id}`)}
            >
              <td className="ledger__strong">
                <Link className="ledger__link" to={`/users/${user.id}`}>
                  {`${user.first_name} ${user.last_name}`.trim() || user.email}
                </Link>
              </td>
              <td>{user.email}</td>
              <td>
                <Badge tone={roleTone(user.role)}>{user.role_display}</Badge>
              </td>
              <td className={siteFor(user).missing ? 'users__site--missing' : undefined}>
                {siteFor(user).label}
              </td>
              <td>
                <span className={`status-dot status-dot--${user.is_active ? 'active' : 'inactive'}`}>
                  <span className="status-dot__mark" aria-hidden />
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{lastActive(user.last_login)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
