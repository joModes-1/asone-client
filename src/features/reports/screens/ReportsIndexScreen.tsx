/**
 * System Reports — Figma 58:2797.
 *
 * Four category cards, each listing its reports with "View Report" opening
 * the category. Previously this route went straight to the stock table,
 * which made every other report invisible.
 *
 * Categories are gated on the access matrix, so Finance and a lead see
 * different lists without either being told a role name.
 *
 * A report the server cannot answer is shown greyed with the reason on
 * hover, rather than hidden. Fourteen of the twenty-three are in that state
 * — see `catalogue.ts` — and hiding them would make the gap invisible to
 * whoever has to close it.
 */

import { Boxes, Coins, School, Truck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components'
import { can } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AppShell } from '@/features/shell/components/AppShell'
import { ReportFilters, type ReportFilterState } from '../components/ReportFilters'
import { useState } from 'react'
import { today } from '../today'
import {
  REPORT_CATEGORIES,
  isLive,
  liveCount,
  type ReportCategory,
} from '../catalogue'

const ICONS: Record<ReportCategory['icon'], LucideIcon> = {
  inventory: Boxes,
  operations: Truck,
  schools: School,
  pricing: Coins,
}

function CategoryCard({ category }: { category: ReportCategory }) {
  const Icon = ICONS[category.icon]
  const live = liveCount(category)

  return (
    <section className="report-group">
      <header className="report-group__head">
        <span className="report-group__icon">
          <Icon size={20} aria-hidden />
        </span>
        <h2 className="report-group__title">{category.title}</h2>

        {category.path ? (
          <Link to={category.path}>
            <Button size="sm">View Report</Button>
          </Link>
        ) : (
          <Button
            size="sm"
            disabled
            title={
              live > 0
                ? 'No screen for this category yet'
                : 'Nothing in this category has an endpoint yet'
            }
          >
            View Report
          </Button>
        )}
      </header>

      <ul className="report-group__list">
        {category.reports.map((report) => (
          <li
            key={report.title}
            className={`report-row${isLive(report) ? '' : ' report-row--pending'}`}
            title={report.note}
          >
            {/*
              A row with a screen behind it is a link. The rest are a
              catalogue of what the data could answer — deliberately inert,
              and marked so, rather than links that go nowhere.
            */}
            {report.path ? (
              <Link className="report-row__title report-row__title--link" to={report.path}>
                {report.title}
              </Link>
            ) : (
              <span className="report-row__title">{report.title}</span>
            )}
            {report.popular && <span className="report-row__tag">Popular</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ReportsIndexScreen() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<ReportFilterState>({
    asOf: today(),
    skuQuery: '',
  })

  const categories = REPORT_CATEGORIES.filter(
    (category) => category.requires === null || can(user, category.requires),
  )

  return (
    <AppShell title="Reports">
      <header className="page-head">
        <h1 className="page-head__title">System Reports</h1>
        <p className="page-head__subtitle">
          Monitor regional stock valuation, tailored garment output, and school fulfilment
          performance.
        </p>
      </header>

      {/* The same band as a report itself, so the filters carry through when
          one is opened rather than resetting. */}
      <ReportFilters value={filters} onChange={setFilters} />

      <div className="reports-index">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </AppShell>
  )
}
