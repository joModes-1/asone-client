/**
 * Approve or decline a pending registration request.
 *
 * Reuses `Modal` — the shared dialog shell. This dialog only shows what the
 * registrant already gave (name, email, phone, whether they verified their
 * address) and asks the one question that matters: approve or decline.
 * Approve is always available — a request with a verified email is ready to
 * become somebody's account the moment a lead says so, and the role itself
 * is picked one step later, not here.
 *
 * Clicking "Approve & Create Account" hands off to `AddUserModal` — the same
 * wizard "+ Add User" opens — pre-filled with this person's details so a
 * lead only does the one thing a registrant could not: pick the role (and a
 * site, if that role needs one). That is one dialog closing and another
 * opening, not two screens layered on top of each other.
 */

import { useState } from 'react'
import { Alert, Badge, Button, Modal } from '@/components'
import { toApiError, type ApiError } from '@/api/errors'
import { AddUserModal } from './AddUserModal'
import { useDeclineRegistration } from '../hooks/useRegistrationRequests'
import * as registrationsApi from '@/api/registrations'
import type { RegistrationRequest, RoleInfo } from '@/api/types'

interface RegistrationReviewModalProps {
  request: RegistrationRequest
  roles: RoleInfo[]
  onClose: () => void
}

type View = 'review' | 'decline' | 'declined' | 'assign-role'

export function RegistrationReviewModal({ request, roles, onClose }: RegistrationReviewModalProps) {
  const [view, setView] = useState<View>('review')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<ApiError | null>(null)

  const declineMutation = useDeclineRegistration()

  async function handleDecline() {
    setError(null)
    try {
      await declineMutation.mutateAsync({ id: request.id, notes: notes.trim() || undefined })
      setView('declined')
    } catch (cause) {
      setError(toApiError(cause))
    }
  }

  if (view === 'assign-role') {
    return (
      <AddUserModal
        roles={roles}
        prefill={request}
        onClose={onClose}
        /*
          Approving takes only the decision a lead makes here — the role and
          its site. Name, email and phone came from the registrant and are
          already on the request, so the endpoint does not take them again;
          passing the whole form through was a type error waiting to be
          noticed.
        */
        onCreate={(input) =>
          registrationsApi.approve(request.id, {
            role: input.role,
            warehouse: input.warehouse ?? undefined,
            school: input.school ?? undefined,
          })
        }
      />
    )
  }

  const title =
    view === 'declined'
      ? 'Request declined'
      : view === 'decline'
        ? 'Decline this request?'
        : 'Review registration request'

  /*
    Actions go in `Modal`'s footer slot, not in the body. The footer is
    pinned below a body that scrolls, so a long request stays confirmable
    without hunting for the buttons — and it is the one place every other
    dialog in the app puts them.
  */
  const footer =
    view === 'review' ? (
      <>
        <Button
          variant="secondary"
          onClick={() => setView('decline')}
          disabled={declineMutation.isPending}
        >
          Decline
        </Button>
        <Button onClick={() => setView('assign-role')}>Approve &amp; Create Account</Button>
      </>
    ) : view === 'decline' ? (
      <>
        <Button
          variant="secondary"
          onClick={() => setView('review')}
          disabled={declineMutation.isPending}
        >
          Back
        </Button>
        <Button
          variant="danger"
          onClick={() => void handleDecline()}
          disabled={declineMutation.isPending}
        >
          {declineMutation.isPending ? 'Declining…' : 'Confirm Decline'}
        </Button>
      </>
    ) : (
      <Button onClick={onClose}>Done</Button>
    )

  return (
    <Modal open title={title} onClose={onClose} size="md" footer={footer}>
      {error && (
        <Alert tone="error">
          <strong>That did not go through.</strong> {error.message}
        </Alert>
      )}

      {view === 'review' && (
        <dl className="wizard__review">
          <div>
            <dt>Full name</dt>
            <dd className="wizard__review-value--accent">
              {request.first_name} {request.last_name}
            </dd>
          </div>
          <div>
            <dt>Email address</dt>
            <dd>{request.email}</dd>
          </div>
          <div>
            <dt>Phone number</dt>
            <dd>{request.phone_number || '—'}</dd>
          </div>
          <div>
            <dt>Email verified</dt>
            <dd>
              <Badge tone={request.is_email_verified ? 'success' : 'warning'}>
                {request.is_email_verified ? 'Verified' : 'Not yet verified'}
              </Badge>
            </dd>
          </div>
        </dl>
      )}

      {view === 'decline' && (
        <>
          <Alert tone="warning">
            No account is created and <strong>nothing is emailed</strong> to{' '}
            {request.first_name}. They will simply see no reply, and may submit
            the form again.
          </Alert>

          {/* `TextField` is input-only, so a textarea uses the same
              `field field--stacked` markup every other form in the app uses
              for one. */}
          <div className="field field--stacked">
            <label htmlFor="decline-notes">Notes</label>
            <textarea
              id="decline-notes"
              className="input input--area"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <p className="field__hint">
              Optional, and only for your own record — the registrant never
              sees it.
            </p>
          </div>
        </>
      )}

      {view === 'declined' && (
        <p className="field__hint">
          The request from {request.first_name} {request.last_name} has been
          declined.
        </p>
      )}
    </Modal>
  )
}
