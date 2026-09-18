/**
 * Uniform Kits — F07.
 *
 * A kit is a bundle a school orders as one line instead of five. It is a
 * convenience for ordering and nothing more: **no warehouse ever holds a
 * kit.** The moment one is ordered it becomes its component SKUs (F33), and
 * everything downstream — availability, picking, packing, the ledger — deals
 * in those.
 *
 * Cards rather than a table, as drawn, and for a reason that survives the
 * design: there are a handful of kits and the thing worth seeing about each
 * is its *contents*, which is a list. A table would either hide that behind a
 * click or grow a column that wraps to four lines.
 *
 * The price on each card is the sum of its components at today's prices,
 * computed by the server on every read. A kit has no price of its own and no
 * bundle discount — it is the sum or it is nothing.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Shirt } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Pagination,
  SkeletonRows,
  TabBar,
} from '@/components'
import { can } from '@/domain/access'
import { formatUGX } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useKitComponents, useKits } from '../hooks/useKits'

type Filter = 'all' | 'PS' | 'HS'

/**
 * Kits per page.
 *
 * Deliberately not `LIST_PAGE_SIZE`. These are cards, not table rows, and
 * each one carries its kit's whole component list — so four of them is
 * already a screenful where ten rows is not. The grid is two columns, so
 * four is exactly two rows and a page never ends on a half-filled one.
 *
 * Paged here rather than on the server: the level tabs filter the set in
 * this component, and a server page would have the tabs narrowing one page
 * of kits instead of all of them. The set is a handful of rows fetched once
 * and cached hard, which is what makes that affordable.
 */
const KITS_PER_PAGE = 4

export function KitsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [level, setLevel] = useState<Filter>('all')
  const [page, setPage] = useState(1)

  const kits = useKits()
  const components = useKitComponents()
  const mayEdit = can(user, 'table_updates')

  const rows = useMemo(() => {
    const all = kits.data?.results ?? []
    return level === 'all' ? all : all.filter((kit) => kit.school_level === level)
  }, [kits.data, level])

  const pageCount = Math.max(Math.ceil(rows.length / KITS_PER_PAGE), 1)
  // Switching tabs can shrink the set under the current page; clamp rather
  // than show an empty grid and leave someone wondering where the kits went.
  const safePage = Math.min(page, pageCount)
  const visible = rows.slice((safePage - 1) * KITS_PER_PAGE, safePage * KITS_PER_PAGE)

  return (
    <AppShell title="Uniform Kits" searchHint="kit">
      <header className="page-head page-head--split">
        <div>
          <h1 className="page-head__title">Uniform Kits</h1>
          <p className="page-head__subtitle">
            Bundles a school orders as one line. Nothing holds a kit in stock —
            ordering one turns it into its component items.
          </p>
        </div>

        {mayEdit && (
          <Button onClick={() => navigate('/kits/new')}>
            <Plus size={16} aria-hidden />
            Create Kit
          </Button>
        )}
      </header>

      <TabBar
        tabs={[
          { key: 'all', label: 'All Kits' },
          { key: 'PS', label: 'Primary School' },
          { key: 'HS', label: 'High School' },
        ]}
        active={level}
        onSelect={(key) => {
          setLevel(key as Filter)
          // Back to the first page: staying on page two of a tab that now
          // has one page shows an empty grid and reads as no kits at all.
          setPage(1)
        }}
        label="School level"
      />

      {kits.isError && (
        <Alert tone="error">
          The kits could not be loaded, so this is not the list a school would
          see. Try again in a moment.
        </Alert>
      )}

      {/*
        Without the components the cards can show a name and a price but not
        what is in the bundle, which is the one thing the screen is for.
      */}
      {components.isError && !kits.isError && (
        <Alert tone="warning">
          The kit contents could not be loaded. The cards below are otherwise
          correct, but none of them can show what is in the bundle.
        </Alert>
      )}

      {kits.isLoading ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={level === 'all' ? 'No kits yet' : 'No kits for this level'}
          body="A kit bundles several garments into one line a school can order — a starter kit, say. Central Office builds them."
          icon={Shirt}
        />
      ) : (
        <div className="kit-grid">
          {visible.map((kit) => {
            const lines = components.byKit.get(kit.id) ?? []

            return (
              <article key={kit.id} className="kit-card">
                <header className="kit-card__head">
                  <div>
                    <h2 className="kit-card__name">{kit.name}</h2>
                    <p className="kit-card__meta">
                      {kit.kit_number} · {kit.school_level_display} ·{' '}
                      {kit.item_count} {kit.item_count === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <Badge tone={kit.is_active ? 'success' : 'neutral'}>
                    {kit.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </header>

                <div className="kit-card__components">
                  <h3 className="kit-card__label">Kit components</h3>
                  {lines.length === 0 ? (
                    /*
                      Not an empty box. A kit with no components cannot be
                      priced and cannot be ordered, which is worth saying
                      where somebody can act on it.
                    */
                    <p className="kit-card__empty">
                      Nothing in this kit yet, so it cannot be priced or ordered.
                    </p>
                  ) : (
                    <ul className="kit-chips">
                      {lines.map((line) => (
                        <li key={line.id} className="kit-chip">
                          {line.sku_description}
                          <span className="kit-chip__qty">×{line.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <footer className="kit-card__foot">
                  <div>
                    <h3 className="kit-card__label">Kit price</h3>
                    <p className="kit-card__price t-numeric">
                      {/*
                        Null is not zero. The server returns null when a
                        component has no price today or the kit is empty —
                        printing "UGX 0" would be a figure somebody could
                        quote to a parent.
                      */}
                      {kit.current_price ? (
                        formatUGX(kit.current_price)
                      ) : (
                        <span className="kit-card__unpriced">Cannot be priced</span>
                      )}
                    </p>
                  </div>

                  <Link className="btn btn--primary btn--sm" to={`/kits/${kit.id}`}>
                    View Detail
                  </Link>
                </footer>
              </article>
            )
          })}
        </div>
      )}

      {/*
        Under the grid, in the same control every list on the system uses.
        Shown whenever there are kits at all: the position line says how many
        there are even on a single page, and "4 of 4" is worth saying on a
        screen whose whole content is four cards.
      */}
      {!kits.isLoading && rows.length > 0 && (
        <div className="table-card__footer">
          <Pagination
            page={safePage}
            pageCount={pageCount}
            totalItems={rows.length}
            pageSize={KITS_PER_PAGE}
            onChange={setPage}
            noun="kits"
          />
        </div>
      )}
    </AppShell>
  )
}
