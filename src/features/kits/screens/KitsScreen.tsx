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
import { Plus, Shirt, Upload } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Pagination,
  SkeletonRows,
} from '@/components'
import { can } from '@/domain/access'
import {
  KIT_FIT_GROUPS,
  KIT_GENDERS,
  KIT_RESIDENCES,
  describeCohort,
} from '@/domain/kitCohort'
import { formatUGX } from '@/domain/money'
import { AppShell } from '@/features/shell/components/AppShell'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ImportKitsModal } from '../components/ImportKitsModal'
import { useKitComponents, useKits } from '../hooks/useKits'

/*
  The school level is not filtered on here any more.
  
  It was three tabs — All, Primary School, High School — from a time when
  that was the only thing distinguishing one kit from another. The class
  band below says it and says more: Nursery, P1–P4 and P5–P7 are the
  Primary kits, S1–S4 and S5–S6 the High School ones. Two controls for one
  question, one of them coarser, is a control to remove.
*/

/**
 * Kits per page.
 *
 * Deliberately not `LIST_PAGE_SIZE`. These are cards, not table rows, and
 * each one carries its kit's whole component list.
 *
 * Nine, because the grid is three columns and nine is exactly three rows —
 * a page never ends on a half-filled one. It was four when the grid was two
 * columns and AsOne had six kits; at 120 that was thirty pages.
 *
 * Paged here rather than on the server: the level tabs filter the set in
 * this component, and a server page would have the tabs narrowing one page
 * of kits instead of all of them. The set is a handful of rows fetched once
 * and cached hard, which is what makes that affordable.
 */
const KITS_PER_PAGE = 9

/** Every cohort, or one of them. "" is "every", which is what a `<select>` sends. */
const ANY = ''

export function KitsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [band, setBand] = useState(ANY)
  const [gender, setGender] = useState(ANY)
  const [residence, setResidence] = useState(ANY)
  const [page, setPage] = useState(1)
  const [importing, setImporting] = useState(false)

  const kits = useKits()
  const components = useKitComponents()
  const mayEdit = can(user, 'table_updates')

  /*
    Narrowed here rather than on the server, like the level tabs above and
    for the same reason: the whole set is fetched once and cached, so a
    server round trip per dropdown would be slower and would have each
    filter narrowing one page of kits instead of all of them.
  */
  const rows = useMemo(() => {
    const all = kits.data ?? []
    return all.filter(
      (kit) =>
        (band === ANY || kit.fit_group === band) &&
        (gender === ANY || kit.gender === gender) &&
        (residence === ANY || kit.residence === residence),
    )
  }, [kits.data, band, gender, residence])

  const filtered = band !== ANY || gender !== ANY || residence !== ANY

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
          <div className="page-head__actions">
            {/*
              Secondary, beside Create rather than instead of it. AsOne load
              their 120 kits from a sheet and build the odd one by hand, so
              both doors stay open and the one-off keeps the emphasis.
            */}
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <Upload size={16} aria-hidden />
              Import Kits
            </Button>
            <Button onClick={() => navigate('/kits/new')}>
              <Plus size={16} aria-hidden />
              Create Kit
            </Button>
          </div>
        )}
      </header>

      {/*
        The cohort a kit is cut for. AsOne's 2027 catalogue is 120 kits —
        five class bands, two genders, day or boarder, six sizes — so a
        school ordering for a Nursery boy boarder is otherwise looking for
        six cards among a hundred and twenty.
      */}
      <div className="filter-bar filter-bar--inline">
        <label className="filter-bar__field">
          <span>Class band:</span>
          <select
            aria-label="Class band"
            value={band}
            onChange={(event) => {
              setBand(event.target.value)
              setPage(1)
            }}
          >
            <option value={ANY}>All</option>
            {KIT_FIT_GROUPS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-bar__field">
          <span>Gender:</span>
          <select
            aria-label="Gender"
            value={gender}
            onChange={(event) => {
              setGender(event.target.value)
              setPage(1)
            }}
          >
            <option value={ANY}>All</option>
            {KIT_GENDERS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-bar__field">
          <span>Day or boarder:</span>
          <select
            aria-label="Day or boarder"
            value={residence}
            onChange={(event) => {
              setResidence(event.target.value)
              setPage(1)
            }}
          >
            <option value={ANY}>All</option>
            {KIT_RESIDENCES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

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
          title={filtered ? 'No kits match these filters' : 'No kits yet'}
          body={
            filtered
              ? 'There is no kit for this combination of class band, gender and residence. Widen one of the filters, or build it.'
              : 'A kit bundles several garments into one line a school can order — a starter kit, say. Central Office builds them.'
          }
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
                    {/*
                      The cohort, where one is stated. On a second line and
                      not folded into the one above, because for AsOne's 2027
                      kits it is the only thing telling two cards apart —
                      the same bundle in six sizes.
                    */}
                    {describeCohort(kit) && (
                      <p className="kit-card__cohort">{describeCohort(kit)}</p>
                    )}
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

      <ImportKitsModal open={importing} onClose={() => setImporting(false)} />
    </AppShell>
  )
}
