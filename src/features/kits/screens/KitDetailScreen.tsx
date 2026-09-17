/**
 * One uniform kit, and what is in it — F07, F33.
 *
 * ---------------------------------------------------------------------------
 * The line worth reading twice
 * ---------------------------------------------------------------------------
 * "Ordering this kit adds N items to the order." That is F33, and it is the
 * whole relationship between this screen and the rest of the system. A kit is
 * a way of *ordering*; it is never a thing anybody stocks, picks or ships. The
 * warehouse will see the component SKUs and nothing else.
 *
 * ---------------------------------------------------------------------------
 * The price is a sum, not a setting
 * ---------------------------------------------------------------------------
 * Every line is priced from the garment's price list today, and the total is
 * their sum. There is no bundle discount and no field to edit — said on the
 * page, because it is the first thing anyone assumes otherwise, and because
 * the design draws a "Calculated Sourcing Cost" box that looks editable.
 *
 * A component with no price on today's list makes the whole total unknown
 * rather than smaller. That is shown as a gap to fix, not as a number.
 */

import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Package, Shirt } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  LoadingScreen,
} from '@/components'
import { can } from '@/domain/access'
import {
  formatCompactUGX,
  formatQuantity,
  formatUGX,
  multiplyMoney,
  sumLineTotals,
} from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useSkuOptions } from '@/features/catalog/hooks/useSkuOptions'
import { useKit, useKitComponents, useUpdateKit } from '../hooks/useKits'
import { Coins, GraduationCap } from 'lucide-react'
import { KpiCard } from '@/features/dashboard/components/KpiCard'

export function KitDetailScreen() {
  const { kitId } = useParams()
  const id = Number(kitId)
  const navigate = useNavigate()
  const { user } = useAuth()

  const kit = useKit(id)
  const components = useKitComponents()
  const skusQuery = useSkuOptions()
  const update = useUpdateKit(id)

  const mayEdit = can(user, 'table_updates')

  if (kit.isLoading) return <LoadingScreen message="Loading the kit" />

  if (kit.isError || !kit.data) {
    return (
      <AppShell title="Uniform Kits">
        <Alert tone="error">
          This kit could not be loaded. It may have been removed, or the server
          is unreachable.
        </Alert>
      </AppShell>
    )
  }

  const lines = components.byKit.get(id) ?? []
  const skus = skusQuery.data?.results ?? []

  const priced = lines.map((line) => {
    const sku = skus.find((entry) => entry.id === line.sku)
    return { line, unitPrice: sku?.unit_price ?? null }
  })

  const unpriced = priced.filter((row) => !row.unitPrice)

  /*
    Summed in integer minor units through `sumLineTotals` — money is never
    added with `+` in this system. Only meaningful when every line has a
    price; otherwise the server's own `current_price` is null and so is this.
  */
  const total =
    lines.length > 0 && unpriced.length === 0
      ? sumLineTotals(
          priced.map((row) => ({
            unit: row.unitPrice as string,
            quantity: row.line.quantity,
          })),
        )
      : null

  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <AppShell title="Uniform Kits">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/kits">Uniform Kits</Link>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page">{kit.data.name}</span>
      </nav>

      <section className="card-panel kit-hero">
        <div className="kit-hero__identity">
          <div className="kit-hero__title">
            <h1 className="page-head__title">{kit.data.name}</h1>
            <Badge tone={kit.data.is_active ? 'success' : 'neutral'}>
              {kit.data.is_active ? 'ACTIVE' : 'INACTIVE'}
            </Badge>
          </div>
          <p className="page-head__subtitle">
            {kit.data.kit_number} · issued to {kit.data.school_level_display} students.
          </p>
        </div>

        {/*
          The dashboard's `KpiCard`, like every other figure in the app. This
          was a `<dl>` of its own with its own type scale, so the two facts
          about a kit looked unlike the facts on every other screen.
        */}
        <div className="kpi-row kit-hero__figures">
          <KpiCard
            label="School level"
            value={kit.data.school_level_display}
            caption="Which price list it appears on"
            icon={GraduationCap}
          />
          <KpiCard
            label="Total kit price"
            /* Compact on a tile, like every other headline figure. The
               exact price is on the component table below, which is what a
               school is invoiced from. */
            value={
              kit.data.current_price
                ? formatCompactUGX(kit.data.current_price)
                : 'Cannot be priced'
            }
            caption="The sum of its components at today's prices"
            icon={Coins}
            tone={kit.data.current_price ? 'default' : 'alert'}
          />
        </div>
      </section>

      {/*
        F33, stated where somebody reading the kit will meet it. Everything
        downstream deals in the components below, never in the kit.
      */}
      {lines.length > 0 && (
        <Alert tone="info">
          Ordering this kit adds <strong>{totalUnits} items</strong> across{' '}
          {lines.length} {lines.length === 1 ? 'line' : 'lines'} to the order. No
          warehouse stocks a kit — picking, packing and shipping all work from
          the items below.
        </Alert>
      )}

      {unpriced.length > 0 && (
        /*
          One missing price makes the whole total unknown, not smaller. Named
          per line, because the fix is on the price list for that garment.
        */
        <Alert tone="warning">
          <strong>
            {unpriced.length === 1 ? 'One item has' : `${unpriced.length} items have`} no
            price today
          </strong>
          , so this kit has no total:{' '}
          {unpriced.map((row) => row.line.sku_number).join(', ')}. A school cannot
          order it until every item is on the current price list.
        </Alert>
      )}

      <section className="card-panel">
        <h2 className="card-panel__title card-panel__title--accent">
          What is in this kit
        </h2>

        {components.isLoading ? (
          <p className="field__hint">Loading the components…</p>
        ) : lines.length === 0 ? (
          <EmptyState
            title="Nothing in this kit yet"
            body="A kit with no components cannot be priced and no school can order it. Add the garments it should contain."
            icon={Package}
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Item</th>
                    <th className="ledger__num">Qty per kit</th>
                    <th className="ledger__num">Unit price</th>
                    <th className="ledger__num">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {priced.map(({ line, unitPrice }) => (
                    <tr key={line.id}>
                      <td className="ledger__code">{line.sku_number}</td>
                      <td className="ledger__wrap">{line.sku_description}</td>
                      <td className="ledger__num t-numeric">
                        {formatQuantity(line.quantity)}
                      </td>
                      <td className="ledger__num t-numeric">
                        {unitPrice ? (
                          formatUGX(unitPrice)
                        ) : (
                          <span className="kit-card__unpriced">No price</span>
                        )}
                      </td>
                      <td className="ledger__num t-numeric ledger__strong">
                        {unitPrice
                          ? formatUGX(multiplyMoney(unitPrice, line.quantity))
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Kit total</td>
                    <td className="ledger__num t-numeric kit-total">
                      {total ? formatUGX(total) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="field__hint">
              The total is the sum of its items at today's prices. A kit has no
              price of its own and carries no bundle discount, so changing a
              garment's price changes this the same day.
            </p>
          </>
        )}
      </section>

      {mayEdit && (
        <div className="compose__bar">
          <div className="compose__summary">
            <p className="compose__count">
              {kit.data.is_active
                ? 'Schools can add this kit to an order.'
                : 'Inactive — no school can add this to a new order.'}
            </p>
          </div>

          <div className="compose__actions">
            {/*
              Deactivated, never deleted: a school's past order was exploded
              into SKUs when it was placed, but reports still name the kit it
              came from.
            */}
            <ConfirmButton
              variant={kit.data.is_active ? 'danger-outline' : 'secondary'}
              confirmLabel={kit.data.is_active ? 'Yes, deactivate it' : 'Yes, reactivate it'}
              title={`${kit.data.is_active ? 'Deactivate' : 'Reactivate'} ${kit.data.name}`}
              pending={update.isPending}
              note={
                kit.data.is_active
                  ? 'No school will be able to add it to a new order. Orders already placed are unaffected, and the kit stays in reports.'
                  : 'Schools will be able to add it to new orders again.'
              }
              onConfirm={() => update.mutate({ is_active: !kit.data.is_active })}
            >
              {kit.data.is_active ? 'Deactivate Kit' : 'Reactivate Kit'}
            </ConfirmButton>

            <Button variant="secondary" onClick={() => navigate(`/kits/${id}/edit`)}>
              <Shirt size={16} aria-hidden />
              Edit Kit
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  )
}
