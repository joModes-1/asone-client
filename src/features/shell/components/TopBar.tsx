/**
 * The top bar — Figma 2001:765.
 *
 * Three things in the design are deliberately not built here:
 *
 *   The "Online · Synced just now" indicator is the offline/sync feature,
 *   which is deferred. Showing a sync state the app does not track would be
 *   a lie on every screen, so it is omitted rather than hardcoded.
 *
 *   Search is inert until `SearchFilter` is added to the server's
 *   DEFAULT_FILTER_BACKENDS — every `search_fields` declaration in the
 *   catalog is currently dead, so the input would return everything.
 *
 *   The bell is not shown to a role scoped to schools. It reads the
 *   warehouse dashboard's notifications, which that role is refused, and
 *   there is no school-side alert feed to put in its place — so it polled a
 *   403 every minute and rendered "none unread", which is a control saying
 *   all clear when it has not been allowed to look.
 *
 * Its placeholder is per screen, because one fixed string cannot be right
 * everywhere: it read "Search SKU, school, center…" on Users & Roles, which
 * names three things that screen does not hold. A screen that has not said
 * what it searches gets a plain "Search…" rather than a guess — naming the
 * wrong subject is worse than naming none.
 */

import { Menu, Search, X } from 'lucide-react'
import { seesWarehouseDashboard } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { HelpButton } from './HelpButton'
import { NotificationBell } from './NotificationBell'
import { WarehouseSwitcher } from './WarehouseSwitcher'

interface TopBarProps {
  /** The current screen's name, shown as the leading chip. */
  title: string
  /** What this screen searches — "SKU, description". Omit for a plain hint. */
  searchHint?: string
  /** Whether the navigation drawer is open — below 1080px only. */
  navOpen: boolean
  onToggleNav: () => void
}

export function TopBar({ title, searchHint, navOpen, onToggleNav }: TopBarProps) {
  const { user } = useAuth()

  return (
    <header className="topbar">
      <div className="topbar__left">
        {/*
          The only way to the navigation below 1080px, and hidden by CSS
          above it where the sidebar is always there. It swaps to a close
          icon while open, so the control that opened the drawer is also the
          one that shuts it — on a phone that is the thumb's first guess.
        */}
        <button
          type="button"
          className="topbar__menu"
          onClick={onToggleNav}
          aria-label={navOpen ? 'Close the menu' : 'Open the menu'}
          aria-expanded={navOpen}
          aria-controls="app-nav"
        >
          {navOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
        </button>

        <span className="topbar__chip">{title}</span>

        <WarehouseSwitcher />
      </div>

      <label className="topbar__search">
        <Search size={14} aria-hidden />
        <input
          type="search"
          placeholder={searchHint ? `Search ${searchHint}…` : 'Search…'}
          disabled
        />
      </label>

      <div className="topbar__actions">
        {seesWarehouseDashboard(user) && <NotificationBell />}
        <HelpButton />
      </div>
    </header>
  )
}
