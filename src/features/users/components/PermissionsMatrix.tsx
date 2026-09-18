/**
 * Role Permissions Matrix Preview.
 *
 * Rows come from `domain/permissionsMatrix` — see that file for why two of
 * the seven rows ("Picking", "Pricing") are approximations rather than a
 * direct read of a server column. A row marked approximate carries a dot
 * next to its label so this is visible in the UI, not just in code.
 */

import { Check, X } from 'lucide-react'
import { PERMISSIONS_MATRIX_ROWS, matrixCell } from '@/domain/permissionsMatrix'
import type { RoleInfo } from '@/api/types'

interface PermissionsMatrixProps {
  roles: RoleInfo[]
  loading: boolean
}

export function PermissionsMatrix({ roles, loading }: PermissionsMatrixProps) {
  if (loading || roles.length === 0) return null

  return (
    <div className="table-scroll">
      <table className="ledger ledger--matrix">
        <thead>
          <tr>
            <th>System Module</th>
            {roles.map((role) => (
              <th key={role.value}>{role.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS_MATRIX_ROWS.map((row) => (
            <tr key={row.label}>
              <td className="ledger__strong">
                {row.label}
                {row.approximate && (
                  <span
                    className="matrix__approx"
                    title="Approximate — no server column maps to this row directly."
                  >
                    *
                  </span>
                )}
              </td>
              {roles.map((role) => (
                <td key={role.value} className="matrix__cell">
                  {matrixCell(role, row) ? (
                    <Check size={16} className="matrix__yes" aria-label="Allowed" />
                  ) : (
                    <X size={16} className="matrix__no" aria-label="Not allowed" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
