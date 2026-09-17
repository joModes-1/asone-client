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
 */

import { useQuery } from '@tanstack/react-query'
import * as dashboardApi from '@/api/dashboard'
import { keys } from '@/api/keys'
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
  const { warehouseId } = useWarehouseFilter()

  const { data, isLoading, isError } = useQuery({
    queryKey: keys.notifications(warehouseId),
    queryFn: () => dashboardApi.notifications({ warehouse: warehouseId }),
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
