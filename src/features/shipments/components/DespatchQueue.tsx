/**
 * Schools with orders picked and waiting — F42's despatch queue.
 *
 * AsOne's checklist asks for a *"consolidated weekly despatch"*: one van to a
 * school carrying every order of theirs that is ready. So the queue is
 * grouped by school rather than listed by order — the unit of work is the
 * van, and the button loads it.
 *
 * ---------------------------------------------------------------------------
 * It says so when it is empty, rather than disappearing
 * ---------------------------------------------------------------------------
 * This used to `return null` with nothing picked, on the reasoning that an
 * empty panel above a full table is furniture. That reasoning was wrong about
 * what this panel is: it is not a summary of the table below, it is the
 * **only** place in the app a van is loaded.
 *
 * So vanishing made "how do I despatch?" answerable only by already knowing.
 * Somebody looking for it found an empty screen, no control, and no clue that
 * the missing step was upstream — a picked order. Now it names the condition.
 *
 * Still hidden for a role that may not despatch at all: telling somebody
 * about a control they will never be allowed is noise, not help.
 */

import { useState } from 'react'
import { Truck } from 'lucide-react'
import { ConfirmButton, SkeletonRows } from '@/components'
import { formatQuantity } from '@/domain/money'
import { canReceiveAndShip } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useWarehouseFilter } from '@/features/shell/hooks/useWarehouseFilter'
import { useDespatch, useDespatchQueue } from '../hooks/useShipments'

export function DespatchQueue() {
  const { user } = useAuth()
  const { warehouseId } = useWarehouseFilter()
  const [loading, setLoading] = useState<number | null>(null)

  const mayDespatch = canReceiveAndShip(user)
  const queue = useDespatchQueue(warehouseId)
  const despatch = useDespatch()

  if (!mayDespatch) return null
  if (queue.isLoading) return <SkeletonRows rows={2} />

  const rows = queue.data ?? []

  if (rows.length === 0) {
    return (
      <section className="despatch">
        <header className="despatch__head">
          <h2 className="despatch__title">Ready to Despatch</h2>
          {/*
            `.panel__clear`, the one-line "nothing here" the hub console's
            panels already use — not the full `EmptyState`, which is sized
            for an empty *table* and left a 400px hole above a full one.
            Names the missing step rather than only the absence: the queue
            fills from picking, and an unpaid order never reaches picking.
          */}
          <p className="panel__clear">
            No van is ready to load. A school appears here once one of its
            orders has been picked — and an order still awaiting payment
            cannot be picked until Finance releases it.
          </p>
        </header>
      </section>
    )
  }

  return (
    <section className="despatch">
      <header className="despatch__head">
        <h2 className="despatch__title">Ready to Despatch</h2>
        <p className="despatch__note">
          One van per school, carrying every order of theirs that is picked.
        </p>
      </header>

      <ul className="despatch__list">
        {rows.map((row) => (
          <li className="despatch__row" key={row.school_id}>
            <div>
              <p className="despatch__school">{row.school__name}</p>
              <p className="despatch__meta">
                {row.orders} order{row.orders === 1 ? '' : 's'} ·{' '}
                {formatQuantity(row.units)} garments
              </p>
            </div>

            {/*
              Despatch moves stock out of the building and cannot be undone —
              there is no way back from a van that has gone. One question
              first, same as picking.
            */}
            <ConfirmButton
              size="sm"
              title={`Despatch to ${row.school__name}?`}
              confirmLabel="Send it"
              pendingLabel="Despatching…"
              pending={loading === row.school_id}
              disabled={despatch.isPending}
              note={`Sends ${row.orders} order${row.orders === 1 ? '' : 's'} to ${row.school__name}. Stock leaves the warehouse and this cannot be undone.`}
              onConfirm={() => {
                setLoading(row.school_id)
                despatch.mutate(
                  {
                    school: row.school_id,
                    ...(warehouseId ? { from_warehouse: warehouseId } : {}),
                  },
                  { onSettled: () => setLoading(null) },
                )
              }}
            >
              <Truck size={14} aria-hidden />
              Despatch
            </ConfirmButton>
          </li>
        ))}
      </ul>
    </section>
  )
}
