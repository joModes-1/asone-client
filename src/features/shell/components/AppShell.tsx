/**
 * The frame every signed-in screen sits in.
 *
 * Sidebar, top bar, and a scrolling content column. Screens pass their own
 * title and body; nothing about a particular screen lives here.
 *
 * ---------------------------------------------------------------------------
 * The navigation is a drawer below 1080px
 * ---------------------------------------------------------------------------
 * It used to collapse to a 72px icon-only rail, with a note in shell.css
 * saying a drawer was the right answer and the mobile designs would settle
 * it. They have not arrived and the rail was worse than it looked: on a
 * 390px phone it took 18% of the width permanently, and with the labels
 * hidden the only way to find a screen was to recognise its icon.
 *
 * So below 1080px the rail is gone and the nav slides in over the content
 * from a button in the top bar. Above it, nothing changes.
 *
 * Closing is handled in three places because there are three ways to leave:
 * the scrim, Escape, and navigating — a drawer left open over the screen
 * somebody just asked for is the commonest way this goes wrong.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface AppShellProps {
  title: string
  /**
   * What this screen searches, for the top bar's placeholder — "users",
   * "SKU, description". A screen that omits it gets a plain "Search…"
   * rather than a guess.
   */
  searchHint?: string
  children: ReactNode
}

export function AppShell({ title, searchHint, children }: AppShellProps) {
  const { user, signOut } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const { pathname } = useLocation()

  /*
    Leaving for another screen closes it. Keyed on the path rather than on
    the click, so a link anywhere — a row, a card, the bell — closes it too.

    Adjusted during render rather than in an effect, which is the documented
    way to derive state from something that can change under you, and the
    same pattern UsersRolesScreen uses to latch the request under review. An
    effect would render the new screen once with the drawer still over it.
  */
  const [navPath, setNavPath] = useState(pathname)
  if (pathname !== navPath) {
    setNavPath(pathname)
    if (navOpen) setNavOpen(false)
  }

  useEffect(() => {
    if (!navOpen) return

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setNavOpen(false)
    }

    // The page behind must not scroll under an open drawer — on a phone
    // that reads as the drawer itself having come loose.
    document.documentElement.classList.add('is-nav-open')
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.documentElement.classList.remove('is-nav-open')
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [navOpen])

  // RequireAuth guarantees a user before this renders; this keeps the type
  // honest rather than asserting non-null.
  if (!user) return null

  return (
    <div className="shell" data-nav-open={navOpen || undefined}>
      <Sidebar user={user} onSignOut={() => void signOut()} />

      {/*
        The scrim is a button so a pointer and the keyboard both reach it,
        and it carries the only label saying what tapping it does. Above the
        content and below the drawer; inert entirely above 1080px, where
        there is no drawer to close.
      */}
      <button
        type="button"
        className="shell__scrim"
        hidden={!navOpen}
        aria-label="Close the menu"
        onClick={() => setNavOpen(false)}
      />

      <div className="shell__main">
        <TopBar
          title={title}
          searchHint={searchHint}
          navOpen={navOpen}
          onToggleNav={() => setNavOpen((open) => !open)}
        />
        <main className="shell__content">{children}</main>
      </div>
    </div>
  )
}
