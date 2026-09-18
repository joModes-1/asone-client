/**
 * "+ Add User" — a wizard: details, review, then the one-time password.
 *
 * ---------------------------------------------------------------------------
 * On the shared `Modal`, not its own overlay
 * ---------------------------------------------------------------------------
 * This was a `position: fixed` div portalled into `<body>`, written when
 * there was no shared dialog. There is one now — `components/Modal.tsx`, on
 * the native `<dialog>` element — and it does by construction what the
 * portal was working around, plus three things the hand-rolled version never
 * had: focus is trapped inside, the rest of the page goes inert to a screen
 * reader, and the top layer means no ancestor's stacking context can cover
 * it.
 *
 * It also cost about ninety lines of CSS that shadowed the real dialog's
 * names. Every `.modal__*` class still used below is prefixed `wizard__`
 * instead, so this file cannot squat on the shared namespace again.
 *
 * ---------------------------------------------------------------------------
 * Three steps, two of them drawn
 * ---------------------------------------------------------------------------
 * The design shows "Step 1 of 3" and a step 3 review; nothing distinguishes
 * a middle step from that review, so step 2 is the review and the counter
 * says so. Worth confirming with the design owner rather than inventing a
 * step to fill the gap.
 *
 * A fourth, undesigned state follows a successful Confirm: the server
 * returns the generated password **once**, on that response only, and never
 * emails it. Dropping it silently would leave a lead with an account they
 * cannot hand over, so it is shown even though no screenshot covers it.
 *
 * `prefill` is this same wizard reached from a registration request rather
 * than a blank form. The fields start filled with what the registrant gave,
 * still editable so a lead can fix a typo, and `onCreate` decides whether
 * that means creating an account or approving the request.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as catalogApi from '@/api/catalog'
import { Alert, Badge, Button, Modal, Select, TextField } from '@/components'
import { toApiError, type ApiError } from '@/api/errors'
import type { RegistrationRequest, RoleInfo, UserAdmin, UserCreate } from '@/api/types'

/**
 * What either creation path returns: the account, and its password once.
 *
 * Both `POST /auth/users/` and the registration approve endpoint answer with
 * this shape — `CreatedUser` and `ApprovedRegistration` — so the wizard is
 * written against the part they share rather than against either one.
 */
export interface Created {
  user: UserAdmin
  password: string | null
}

interface AddUserModalProps {
  roles: RoleInfo[]
  onClose: () => void
  /** Pre-fills name, email and phone, and skips straight to the role step. */
  prefill?: RegistrationRequest
  /*
    Typed as the API's own `UserCreate`, not an inline literal. The literal
    said `role: string` where the generated type is a union of the five
    roles, so the two were "different types with the same name" and neither
    call site could satisfy both.
  */
  onCreate: (input: UserCreate) => Promise<Created>
}

interface Draft {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  role: string
  site: string
}

const EMPTY: Draft = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  role: '',
  site: '',
}

export function AddUserModal({ roles, onClose, onCreate, prefill }: AddUserModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [draft, setDraft] = useState<Draft>(
    prefill
      ? {
          ...EMPTY,
          firstName: prefill.first_name,
          lastName: prefill.last_name,
          email: prefill.email,
          phoneNumber: prefill.phone_number,
        }
      : EMPTY,
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [created, setCreated] = useState<Created | null>(null)

  const role = roles.find((entry) => entry.value === draft.role) ?? null
  const siteKind = role?.requires_site ?? null // "warehouse" | "school" | null

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', 'all'],
    queryFn: () => catalogApi.warehouses(),
    enabled: siteKind === 'warehouse',
  })
  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => catalogApi.schools(),
    enabled: siteKind === 'school',
  })

  const sites =
    siteKind === 'warehouse'
      ? warehouses?.results
      : siteKind === 'school'
        ? schools?.results
        : []

  const complete =
    draft.firstName.trim() &&
    draft.lastName.trim() &&
    draft.email.trim() &&
    draft.role &&
    (!siteKind || draft.site)

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function handleConfirm() {
    if (!role) return
    setPending(true)
    setError(null)
    try {
      const result = await onCreate({
        first_name: draft.firstName,
        last_name: draft.lastName,
        email: draft.email,
        /*
          Sent, at last. The form collected a phone number, echoed it back on
          the review step and then dropped it — the server has carried
          `phone_number` on User and in UserCreateSerializer all along, so a
          lead was confirming a detail that never reached the account.
        */
        ...(draft.phoneNumber.trim() ? { phone_number: draft.phoneNumber.trim() } : {}),
        role: role.value as UserCreate['role'],
        warehouse: siteKind === 'warehouse' && draft.site ? Number(draft.site) : undefined,
        school: siteKind === 'school' && draft.site ? Number(draft.site) : undefined,
        must_change_password: true,
      })
      setPending(false)
      if (result.password) setCreated(result)
      else onClose()
    } catch (caught) {
      setError(toApiError(caught))
      setPending(false)
    }
  }

  const siteName = sites?.find((entry) => String(entry.id) === draft.site)?.name

  /* The password screen is an outcome, not a step, so it says so. */
  const title = created ? 'Account created' : 'Add New User'
  const subtitle = created ? undefined : `Step ${step} of 2`

  return (
    <Modal
      open
      size="md"
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        created ? (
          <Button onClick={onClose}>Done</Button>
        ) : step === 1 ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!complete} onClick={() => setStep(2)}>
              Review
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep(1)} disabled={pending}>
              Back
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={pending}>
              {pending ? 'Creating…' : 'Confirm'}
            </Button>
          </>
        )
      }
    >
      {!created && (
        <div className="wizard__progress" aria-hidden>
          <span className="wizard__progress-bar wizard__progress-bar--done" />
          <span
            className={`wizard__progress-bar${step >= 2 ? ' wizard__progress-bar--done' : ''}`}
          />
        </div>
      )}

      {step === 1 && !created && (
        <>
          <div className="wizard__grid">
            <TextField
              label="First Name"
              required
              value={draft.firstName}
              onChange={(event) => update('firstName', event.target.value)}
            />
            <TextField
              label="Last Name"
              required
              value={draft.lastName}
              onChange={(event) => update('lastName', event.target.value)}
            />
          </div>

          <TextField
            label="Email Address"
            type="email"
            required
            value={draft.email}
            onChange={(event) => update('email', event.target.value)}
          />

          <TextField
            label="Phone Number"
            type="tel"
            value={draft.phoneNumber}
            onChange={(event) => update('phoneNumber', event.target.value)}
          />

          <Select
            label="Role"
            required
            value={draft.role}
            onChange={(event) => {
              update('role', event.target.value)
              update('site', '')
            }}
          >
            <option value="" disabled>
              Select a role
            </option>
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
              value={draft.site}
              onChange={(event) => update('site', event.target.value)}
            >
              <option value="" disabled>
                Select a {siteKind}
              </option>
              {(sites ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          )}

          {role && (
            <div className="wizard__preview">
              <p className="wizard__preview-title">What this role may do</p>
              <p className="wizard__preview-summary">{role.summary}</p>
            </div>
          )}
        </>
      )}

      {step === 2 && role && !created && (
        <>
          {error && (
            <Alert tone="error">
              <strong>The account was not created.</strong> {error.message}
            </Alert>
          )}

          <dl className="wizard__review">
            <div>
              <dt>Full name</dt>
              <dd className="wizard__review-value--accent">
                {draft.firstName} {draft.lastName}
              </dd>
            </div>
            <div>
              <dt>Email address</dt>
              <dd>{draft.email}</dd>
            </div>
            <div>
              <dt>Phone number</dt>
              <dd>{draft.phoneNumber || '—'}</dd>
            </div>
            <div>
              <dt>System role</dt>
              <dd>
                <Badge tone="info">{role.label}</Badge>
              </dd>
            </div>
            {siteKind && (
              <div>
                <dt>Assigned site</dt>
                <dd>{siteName ?? '—'}</dd>
              </div>
            )}
          </dl>
        </>
      )}

      {created && (
        <>
          {/*
            The one moment this password exists anywhere a person can read
            it. Said plainly, because closing this dialog is irreversible in
            a way nothing else on the screen is.
          */}
          <Alert tone="warning">
            <strong>Shown once.</strong> Pass this to {created.user.first_name}{' '}
            yourself — it is not emailed and cannot be shown again. If it is
            lost, set a new one on their account.
          </Alert>

          <dl className="wizard__review">
            <div>
              <dt>One-time password</dt>
              <dd className="wizard__review-value--accent wizard__review-value--mono">
                {created.password}
              </dd>
            </div>
          </dl>
        </>
      )}
    </Modal>
  )
}
