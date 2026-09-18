/**
 * Which dashboard `/dashboard` means.
 *
 * There are two, and they are two screens rather than one with a wider
 * audience — the server draws the same line, with `CanSeeWarehouseDashboard`
 * and `CanSeeSchoolDashboard` refusing each other's roles.
 *
 * The split is on **scope, not role name**, like every other access decision
 * in `domain/access.ts`: a role scoped to schools gets the school screen. A
 * sixth role added tomorrow with `assigned_schools` lands in the right place
 * without a change here.
 *
 * One path rather than two so the sidebar has one Dashboard destination and
 * nobody can be shown a link that answers 403 when they follow it.
 *
 * The predicate is shared with the top bar, which uses the same line to
 * decide whether to show the notification bell — that endpoint sits behind
 * the same server permission as this screen.
 */

import { seesWarehouseDashboard } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { DashboardScreen } from './DashboardScreen'
import { SchoolDashboardScreen } from './SchoolDashboardScreen'

export function HomeScreen() {
  const { user } = useAuth()

  if (!seesWarehouseDashboard(user)) return <SchoolDashboardScreen />

  return <DashboardScreen />
}
