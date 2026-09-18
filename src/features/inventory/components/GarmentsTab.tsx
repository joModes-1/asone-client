/**
 * The garment table — what a SKU is one size of, and what carries the price.
 *
 * ---------------------------------------------------------------------------
 * Why this is a tab on Inventory rather than a screen
 * ---------------------------------------------------------------------------
 * Garments and SKUs were two sidebar entries leading to placeholders. The
 * Stock tab beside this one *is* the SKU list, so SKUs never needed a screen;
 * garments did, but only for this — a short table, edited a few times a year.
 * Inventory & Products is one destination: Stock answers how many, Garments
 * answers what they are and what they cost.
 *
 * Price is a column here rather than a screen of its own because a price is
 * an attribute of a garment. Naming a screen "Pricing" would have hidden
 * that it was really the garment table with one extra column.
 *
 * Unpriced garments are called out rather than left to be discovered: a
 * garment with no price cannot be ordered at all — `price_for()` raises, so
 * every SKU beneath it refuses to cost and the kit total refuses to compute.
 */

import { useState } from 'react'
import { Pencil, Shirt } from 'lucide-react'
import { Alert, Badge, Button, EmptyState, Pagination, SkeletonRows } from '@/components'
import { LIST_PAGE_SIZE } from '@/api/pageSize'
import { can } from '@/domain/access'
import { formatUGX } from '@/domain/money'
import { swatchFor } from '@/domain/garmentColours'
import { schoolLevelLabel } from '@/domain/sizes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { Garment } from '@/api/types'
import { useGarmentOptions } from '../hooks/useGarmentOptions'
import { EditGarmentModal } from './CreateGarmentModal'
import { RepriceModal } from './RepriceModal'

export function GarmentsTab() {
  const { user } = useAuth()
  const { garments, isLoading } = useGarmentOptions({ includeInactive: true })
  const mayEdit = can(user, 'table_updates')

  const [editing, setEditing] = useState<Garment | null>(null)
  const [pricing, setPricing] = useState<Garment | null>(null)
  const [page, setPage] = useState(1)

  const unpriced = garments.filter((garment) => !garment.current_price)

  /*
   * Paged client-side: the whole set is one cached fetch — AsOne has tens of
   * garments, not thousands — and the unpriced warning above counts all of
   * them rather than this page. Same shape as the SKU ledger.
   */
  const pageCount = Math.max(Math.ceil(garments.length / LIST_PAGE_SIZE), 1)
  const safePage = Math.min(page, pageCount)
  const visible = garments.slice(
    (safePage - 1) * LIST_PAGE_SIZE,
    safePage * LIST_PAGE_SIZE,
  )

  if (isLoading) return <SkeletonRows rows={6} />

  if (garments.length === 0) {
    return (
      <EmptyState
        icon={Shirt}
        title="No garments yet"
        body="A garment is a uniform component before a size is chosen. Add one from Create New SKU."
      />
    )
  }

  return (
    <>
      {unpriced.length > 0 && (
        <Alert tone="warning">
          <strong>
            {unpriced.length === 1
              ? '1 garment has no price.'
              : `${unpriced.length} garments have no price.`}
          </strong>{' '}
          Nothing beneath an unpriced garment can be ordered — an order line
          has nothing to cost and a kit total refuses to compute.
        </Alert>
      )}

      <div className="table-card">
        <div className="table-scroll">
          <table className="ledger garments-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Garment</th>
                <th>Level</th>
                <th>Colour</th>
                <th className="ledger__num">SKUs</th>
                <th className="ledger__num">Price today</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((garment) => (
                <tr key={garment.id}>
                  <td className="ledger__link">{garment.code}</td>
                  <td className="ledger__strong ledger__wrap" title={garment.name}>
                    {garment.name}
                  </td>
                  <td>
                    <Badge tone={garment.school_level === 'HS' ? 'purple' : 'teal'}>
                      {schoolLevelLabel(garment.school_level)}
                    </Badge>
                  </td>
                  <td>
                    {garment.colour ? (
                      <span className="modal-form__swatch-value">
                        <span
                          className="modal-form__swatch"
                          style={{ background: swatchFor(garment) }}
                          aria-hidden
                        />
                        {garment.colour}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="ledger__num">{garment.sku_count}</td>
                  <td className="ledger__num t-numeric">
                    {garment.current_price ? (
                      formatUGX(garment.current_price)
                    ) : (
                      <span className="users__site--missing">Not priced</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={garment.is_active === false ? 'error' : 'success'}>
                      {garment.is_active === false ? 'Retired' : 'Active'}
                    </Badge>
                  </td>
                  <td>
                    {mayEdit && (
                      <div className="garment-row__actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPricing(garment)}
                        >
                          Price
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Edit ${garment.name}`}
                          onClick={() => setEditing(garment)}
                        >
                          <Pencil size={14} aria-hidden />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-card__footer">
          <Pagination
            page={safePage}
            pageCount={pageCount}
            totalItems={garments.length}
            pageSize={LIST_PAGE_SIZE}
            onChange={setPage}
            noun="garments"
          />
        </div>
      </div>

      <EditGarmentModal
        open={editing !== null}
        garment={editing}
        onClose={() => setEditing(null)}
      />
      <RepriceModal
        open={pricing !== null}
        garment={pricing}
        onClose={() => setPricing(null)}
      />
    </>
  )
}
