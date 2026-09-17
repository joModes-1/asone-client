/**
 * The bell.
 *
 * `unread_count` drives the badge and the messages are already worded and
 * graded by the server, so the bell and the Needs Attention panel cannot
 * disagree about the same problem — they are the same source.
 *
 * Polled rather than pushed: there is no websocket, and a count that is a
 * minute stale is not misleading. Refetching on focus is deliberate here
 * even though it is off globally — coming back to the tab is exactly when
 * somebody wants to know what changed.
 *
 * `isError` is returned rather than swallowed. A failed poll left the bell
 * reading zero, which is the same thing it shows when everything is fine —
 * so a server that was down looked like a warehouse with nothing wrong.
 * The caller shows that it could not check instead of a count it does not
 * have.
 *
 * ---------------------------------------------------------------------------
 * Two feeds, one bell
 * ---------------------------------------------------------------------------
 * A school is refused the warehouse feed — most of what it reports is about
 * somebody else's building — and gets `/dashboard/school/notifications/`
 * instead. Both return the same shape, so the choice is made once here and
 * the bell component never learns there are two.
 *
 * This replaced hiding the bell from School Staff altogether, which was
 * wrong: confirming a delivery is theirs alone, so they were the one role
 * with a personal to-do list and nowhere to read it.
 */

import { useQuery } from '@tanstack/react-query'
import * as dashboardApi from '@/api/dashboard'
import { keys } from '@/api/keys'
import { seesWarehouseDashboard } from '@/domain/access'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useWarehouseFilter } from './useWarehouseFilter'
import type { NotificationItem } from '@/api/types'

const POLL_MS = 60_000

export interface Notifications {
  /**
   * How many conditions are currently true — **not** an inbox count. It
   * falls when the low stock is replenished or the order is picked, never
   * because somebody opened the panel. The server says the same in
   * `dashboard/services.py::notifications`.
   */
  alertCount: number
  items: NotificationItem[]
  isLoading: boolean
  isError: boolean
}

export function useNotifications(): Notifications {
  const { user } = useAuth()
  const { warehouseId } = useWarehouseFilter()
  const warehouseSide = seesWarehouseDashboard(user)

  const { data, isLoading, isError } = useQuery({
    // The school's feed takes no warehouse, so its key must not carry one —
    // otherwise switching the (invisible) warehouse filter would refetch the
    // same answer under a different key.
    queryKey: warehouseSide ? keys.notifications(warehouseId) : ['notifications', 'school'],
    queryFn: () =>
      warehouseSide
        ? dashboardApi.notifications({ warehouse: warehouseId })
        : dashboardApi.schoolNotifications(),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })

  return {
    alertCount: data?.unread_count ?? 0,
    items: data?.notifications ?? [],
    isLoading,
    isError,
  }
}
