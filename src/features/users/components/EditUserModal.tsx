/**
 * Edit Profile — the detail screen's own edit, on `Modal.tsx` (the shared
 * shell), not `AddUserModal`'s hand-rolled one.
 *
 * Name, email, phone, and now the role (and site, if the new role needs
 * one). The server owns the actual invariant — `UserAdminSerializer` builds
 * the candidate user and runs `User.clean()` on it, so a role/site mismatch
 * comes back as a 400 regardless of what this form allows through — this
 * only mirrors that so the mismatch is caught before submitting, not after.
 *
 * Role is disabled entirely when editing your own account: `_guard_self`
 * refuses that server-side ("You cannot change the role of your own
 * account"), so disabling it here says why up front rather than letting
 * someone fill in a new role and be told no at Save.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Modal, Select, TextField } from '@/components'
import { toApiError, type ApiError } from '@/api/errors'
import * as catalogApi from '@/api/catalog'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useRoles } from '../hooks/useRoles'
import { useUpdateUser } from '../hooks/useUsers'
import type { UserAdmin } from '@/api/types'

interface EditUserModalProps {
  user: UserAdmin
  onClose: () => void
}

export function EditUserModal({ user, onClose }: EditUserModalProps) {
  const { user: signedInUser } = useAuth()
  const isSelf = signedInUser?.id === user.id

  const [firstName, setFirstName] = useState(user.first_name ?? '')
  const [lastName, setLastName] = useState(user.last_name ?? '')
  const [email, setEmail] = useState(user.email)
  const [phoneNumber, setPhoneNumber] = useState(user.phone_number ?? '')
  const [role, setRole] = useState(user.role)
  const [site, setSite] = useState(String(user.warehouse ?? user.school ?? ''))
  const [error, setError] = useState<ApiError | null>(null)

  const updateUser = useUpdateUser()
  const { data: roles } = useRoles()

  const roleInfo = roles?.find((entry) => entry.value === role) ?? null
  const siteKind = roleInfo?.requires_site ?? null

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

  const sites = siteKind === 'warehouse' ? warehouses?.results : siteKind === 'school' ? schools?.results : []

  async function handleSave() {
    setError(null)
    try {
      await updateUser.mutateAsync({
        id: user.id,
        body: {
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: phoneNumber,
          ...(isSelf
            ? {}
            : {
                role,
                warehouse: siteKind === 'warehouse' && site ? Number(site) : null,
                school: siteKind === 'school' && site ? Number(site) : null,
              }),
        },
      })
      onClose()
    } catch (cause) {
      setError(toApiError(cause))
    }
  }

  const complete =
    firstName.trim() && lastName.trim() && email.trim() && (isSelf || (role && (!siteKind || site)))

  return (
    <Modal open title="Edit Profile" onClose={onClose} size="sm">
      {error && <p className="modal__error">{error.message}</p>}

      <div className="modal__grid">
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
        value={phoneNumber}
        onChange={(event) => setPhoneNumber(event.target.value)}
      />

      <Select
        label="Role"
        required
        value={role}
        disabled={isSelf}
        onChange={(event) => {
          setRole(event.target.value)
          setSite('')
        }}
      >
        {(roles ?? []).map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </Select>
      {isSelf && <p className="modal__body-note">You cannot change the role of your own account.</p>}

      {!isSelf && siteKind && (
        <Select label="Assigned Site" required value={site} onChange={(event) => setSite(event.target.value)}>
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

      <div className="modal__actions">
        <Button variant="secondary" onClick={onClose} disabled={updateUser.isPending}>
          Cancel
        </Button>
        <Button onClick={() => void handleSave()} disabled={!complete || updateUser.isPending}>
          {updateUser.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </Modal>
  )
}
