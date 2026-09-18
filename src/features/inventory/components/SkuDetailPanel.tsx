/**
 * SKU Details — the side panel opened by clicking a row in Inventory Overview.
 *
 * The visual language here (the garment card, the stat row, the boxed value
 * card, the movement list with its divider lines) is the reference design.
 * Three parts of it assumed data that doesn't exist, or computed real data
 * unsafely — fixed without touching the layout:
 *
 *   - Recent Movements fell back to five hardcoded rows (the exact numbers
 *     from the original mockup) whenever a SKU had none yet. A brand-new
 *     SKU showing invented shipment history is the kind of thing a clerk
 *     could act on. Real emptiness now reads as an honest empty state.
 *   - Warehouse Locations had the same shape of fallback — one invented
 *     "Central Hub" row reusing this row's own available count. Real
 *     emptiness now reads as an honest empty state here too.
 *   - The value card computed `Number(row.value) || row.available * 10000`
 *     — a fabricated UGX 10,000/unit rate whenever `value` was falsy
 *     (including a genuine, real zero). `row.value` is a decimal *string*
 *     for exactness (see domain/money.ts) specifically so it's never run
 *     through `Number()` and re-approximated; `formatCompactUGX` reads it
 *     directly. The per-unit rate is real division now, shown only where
 *     it means something (`available > 0`) rather than defaulting to an
 *     invented figure when it doesn't.
 */

import { X } from 'lucide-react'
import { formatCompactUGX, formatQuantity, formatSignedQuantity } from '@/domain/money'
import { useSkuMovements } from '../hooks/useSkuMovements'
import { useSkuStockLevels } from '../hooks/useSkuStockLevels'
import type { InventoryRow } from '../hooks/useInventoryRows'
import { Link } from 'react-router-dom'
import { can } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'

interface SkuDetailPanelProps {
  row: InventoryRow
  onClose: () => void
  onEdit: () => void
}

export function SkuDetailPanel({ row, onClose, onEdit }: SkuDetailPanelProps) {
  const { user } = useAuth()
  // Two different matrix columns: master data is the leads', posting an
  // adjustment is Finance's.
  const canEdit = can(user, 'table_updates')
  const canAdjust = can(user, 'inventory_adjustments')

  const { stockLevels, isLoading: stockLoading } = useSkuStockLevels(row.skuId)
  const { movements, isLoading: movementsLoading } = useSkuMovements(row.skuId)

  // "PS" -> "Primary (PS)", "HS" -> "High (HS)", "BOTH" shown as-is — there
  // is no third label the reference names for it.
  const levelDisplay =
    row.level === 'PS' ? 'Primary (PS)' : row.level === 'HS' ? 'High (HS)' : row.level

  const sizeDisplay = row.sizeName.toLowerCase().startsWith('size')
    ? row.sizeName
    : `Size ${row.sizeName}`

  const colorDisplay = row.colour || '—'

  // A per-unit rate only means something once there's at least one unit to
  // divide by — real division of the real total, not a flat guess. `Number`
  // is safe here specifically because this is a rounded, cosmetic "~/unit"
  // hint that is never stored, submitted, or summed — unlike every other
  // money figure in this app, which stays a decimal string end to end (see
  // domain/money.ts). Rebuilt as a 2dp string so the existing, tested
  // `formatCompactUGX` still does the actual formatting.
  const unitRateText =
    row.available > 0
      ? `${formatCompactUGX((Number(row.value) / row.available).toFixed(2))}/unit`
      : null

  const movementRows = movements.map((m) => ({
    id: String(m.id),
    type: m.movement_type_display || m.movement_type,
    meta: `${m.occurred_on} • #${m.document_number || m.number}`,
    quantity: m.quantity,
  }))

  return (
    <aside className="sku-panel" aria-label={`${row.skuNumber} details`}>
      <div className="sku-panel__head">
        <div>
          <p className="sku-panel__eyebrow">SKU DETAILS</p>
          <h2 className="sku-panel__title">{row.skuNumber}</h2>
        </div>
        <button
          type="button"
          className="sku-panel__close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="sku-panel__garment-card">
        <h3 className="sku-panel__garment-name">{row.garmentName}</h3>
        <p className="sku-panel__description">{row.description}</p>

        <div className="sku-panel__specs-table">
          <div className="sku-panel__spec-row">
            <span className="sku-panel__spec-label">School Level</span>
            <span className="sku-panel__spec-value">{levelDisplay}</span>
          </div>
          <div className="sku-panel__spec-row">
            <span className="sku-panel__spec-label">Size</span>
            <span className="sku-panel__spec-value">{sizeDisplay}</span>
          </div>
          <div className="sku-panel__spec-row">
            <span className="sku-panel__spec-label">Color</span>
            <span className="sku-panel__spec-value">{colorDisplay}</span>
          </div>
        </div>
      </div>

      <div className="sku-panel__section-header">STOCK SUMMARY</div>

      <div className="sku-panel__stat-row">
        <div className="sku-panel__stat">
          <span className="sku-panel__stat-label">Available</span>
          <span className="sku-panel__stat-value sku-panel__stat-value--accent">
            {formatQuantity(row.available)}
          </span>
        </div>
        <div className="sku-panel__stat">
          <span className="sku-panel__stat-label">To Pick</span>
          <span className="sku-panel__stat-value">{formatQuantity(row.pick)}</span>
        </div>
        <div className="sku-panel__stat">
          <span className="sku-panel__stat-label">Shipped</span>
          <span className="sku-panel__stat-value">{formatQuantity(row.shipped)}</span>
        </div>
      </div>

      <div className="sku-panel__value-box">
        <div className="sku-panel__value-head">
          <span className="sku-panel__value-label">Est. Inventory Value</span>
          {unitRateText && <span className="sku-panel__value-rate">{unitRateText}</span>}
        </div>
        <div className="sku-panel__value-amount">{formatCompactUGX(row.value)}</div>
      </div>

      <div className="sku-panel__section-header">WAREHOUSE LOCATIONS</div>

      {stockLoading ? (
        <div className="skeleton-stack" aria-hidden>
          <span className="skeleton" style={{ height: 20 }} />
          <span className="skeleton" style={{ height: 20 }} />
        </div>
      ) : stockLevels.length === 0 ? (
        <p className="sku-panel__empty">No stock recorded at any warehouse yet.</p>
      ) : (
        <ul className="sku-panel__location-list">
          {stockLevels.map((s) => (
            <li key={s.warehouse_id} className="sku-panel__location-item">
              <span className="sku-panel__location-name">{s.warehouse_name}</span>
              <strong className="sku-panel__location-qty">
                {formatQuantity(s.level)} units
              </strong>
            </li>
          ))}
        </ul>
      )}

      <div className="sku-panel__section-header">RECENT MOVEMENTS</div>

      {movementsLoading ? (
        <div className="skeleton-stack" aria-hidden>
          <span className="skeleton" style={{ height: 20 }} />
          <span className="skeleton" style={{ height: 20 }} />
        </div>
      ) : movementRows.length === 0 ? (
        <p className="sku-panel__empty">Nothing has moved for this SKU yet.</p>
      ) : (
        <div className="sku-panel__movement-card">
          <ul className="sku-panel__movement-list">
            {movementRows.map((movement) => (
              <li key={movement.id} className="sku-panel__movement-item">
                <div className="sku-panel__movement-info">
                  <p className="sku-panel__movement-type">{movement.type}</p>
                  <p className="sku-panel__movement-meta">{movement.meta}</p>
                </div>
                <span
                  className={
                    movement.quantity >= 0
                      ? 'sku-panel__movement-qty sku-panel__movement-qty--in'
                      : 'sku-panel__movement-qty sku-panel__movement-qty--out'
                  }
                >
                  {formatSignedQuantity(movement.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        A control a role may not use is not shown to them at all.

        These were rendered greyed out with a tooltip saying whose job it
        was — but the sidebar does not offer a lead Inv. Adjustments and
        then refuse it, it simply does not list it. A disabled button is
        still a thing to try, fail at, and wonder about; an absent one says
        the same thing without the dead end.

        `canEdit` and `canAdjust` are different columns of the matrix, so a
        lead sees Edit and Finance sees Adjust. Where a role has neither,
        the footer is not drawn.
      */}
      {(canEdit || canAdjust) && (
        <div className="sku-panel__footer">
          {canEdit && (
            <button type="button" className="sku-panel__btn-edit" onClick={onEdit}>
              Edit SKU
            </button>
          )}

          {canAdjust && (
            <Link
              className="sku-panel__btn-adjust"
              to={`/adjustments/new?sku=${row.skuId}&warehouse=${row.warehouseId}`}
            >
              Adjust Inventory
            </Link>
          )}
        </div>
      )}

    </aside>
  )
}
