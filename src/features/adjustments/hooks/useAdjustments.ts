/**
 * Adjustment and transfer data.
 *
 * Every mutation here ends in a permanent ledger row, so each one invalidates
 * the stock figures other screens are showing. Getting that wrong is how a
 * warehouse screen goes on reporting 245 units for the rest of the session
 * after Finance has just written five of them off.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as adjustmentsApi from '@/api/adjustments'
import * as inventoryApi from '@/api/inventory'
import { snackbar } from '@/components'
import { formatSigned } from '@/domain/adjustments'
import type { InventoryAdjustment } from '@/api/types'
import { LIST_PAGE_SIZE } from '@/api/pageSize'

export const ADJUSTMENTS_PAGE_SIZE = LIST_PAGE_SIZE
export const TRANSFERS_PAGE_SIZE = LIST_PAGE_SIZE

/**
 * The reason codes table.
 *
 * Long-lived: Central Office changes it rarely, and every screen here needs
 * it to know which way a quantity points.
 */
export function useReasonCodes() {
  return useQuery({
    queryKey: ['reason-codes'],
    queryFn: () => adjustmentsApi.reasonCodes(),
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * `since` is a `YYYY-MM-DD` lower bound, or null for all of it — the "Date
 * Range" control. Applied on the server, unlike search and type, which can
 * only narrow the page in front of you.
 */
export function useAdjustments(
  page: number,
  warehouseId: number | null,
  since: string | null,
) {
  return useQuery({
    queryKey: ['adjustments', 'list', page, warehouseId, since],
    queryFn: () =>
      adjustmentsApi.adjustments({
        page,
        page_size: ADJUSTMENTS_PAGE_SIZE,
        ...(warehouseId ? { warehouse: warehouseId } : {}),
        ...(since ? { date_from: since } : {}),
      }),
    placeholderData: keepPreviousData,
  })
}

export function useTransfers(page: number, since: string | null) {
  return useQuery({
    queryKey: ['transfers', 'list', page, since],
    queryFn: () =>
      adjustmentsApi.transfers({
        page,
        page_size: TRANSFERS_PAGE_SIZE,
        ...(since ? { date_from: since } : {}),
      }),
    placeholderData: keepPreviousData,
  })
}

/**
 * Stock on hand at one warehouse, by SKU.
 *
 * The form needs it twice over: to print what the system thinks is there
 * before anyone types a count, and to stop a decrease being keyed that the
 * shelf cannot cover. Summed from the ledger on read, so there is no stored
 * figure to go stale — but it is still a moment ago's truth, and the server
 * checks again at posting.
 */
export function useStockOnHand(warehouseId: number | null) {
  return useQuery({
    queryKey: ['stock-levels', warehouseId, 'with-zero'],
    queryFn: () =>
      inventoryApi.stockLevels({
        ...(warehouseId ? { warehouse: warehouseId } : {}),
        include_zero: true,
      }),
    enabled: warehouseId !== null,
  })
}

/** Everything a posted row could have changed. */
function invalidateStock(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['adjustments'] })
  void queryClient.invalidateQueries({ queryKey: ['transfers'] })
  void queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
  void queryClient.invalidateQueries({ queryKey: ['movements'] })
  void queryClient.invalidateQueries({ queryKey: ['reorder-alerts'] })
  void queryClient.invalidateQueries({ queryKey: ['inventory'] })
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

/**
 * Create then post, as one action from the screen's point of view.
 *
 * The server keeps these apart so an adjustment can be checked before it is
 * committed; the design draws one "Post Adjustment" button. Both are true —
 * the check happens on the form, where the figures are on screen — but the
 * two calls must not half-succeed: a created-and-unposted adjustment left
 * behind by a failed post is a draft nobody knows exists. So the failure is
 * reported with the number of the draft it left, rather than swallowed.
 */
export function usePostAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: adjustmentsApi.AdjustmentInput) => {
      const draft = await adjustmentsApi.createAdjustment(input)
      try {
        return await adjustmentsApi.postAdjustment(draft.id)
      } catch (error) {
        throw new DraftLeftBehind(draft.number, error)
      }
    },
    onSuccess: (adjustment) => {
      invalidateStock(queryClient)
      snackbar.success(
        `${adjustment.number} posted`,
        `${adjustment.reason_code_name} — ${adjustment.quantity} units of ${adjustment.sku_number} at ${adjustment.warehouse_name}.`,
      )
    },
  })
}

/**
 * A post that failed after its draft was already written.
 *
 * Carries the draft's number so the screen can name it. Without this the
 * reader is told the adjustment failed while a numbered draft of it sits in
 * the list, which is worse than either outcome on its own.
 */
export class DraftLeftBehind extends Error {
  constructor(
    readonly draftNumber: string,
    readonly cause: unknown,
  ) {
    super(`Adjustment ${draftNumber} was written down but could not be posted.`)
    this.name = 'DraftLeftBehind'
  }
}

/**
 * Physical count correction — F24.
 *
 * Posts straight away when the count differs, and writes nothing at all when
 * it matches. That second case is a success with no document, so it gets its
 * own message: silence would read as a failure.
 */
export function useCorrectCount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: adjustmentsApi.CountCorrectionInput) =>
      adjustmentsApi.correctCount(input),
    onSuccess: (adjustment: InventoryAdjustment | null) => {
      invalidateStock(queryClient)

      if (!adjustment) {
        snackbar.info(
          'The count matched',
          'Nothing was posted — the shelf and the system already agree.',
        )
        return
      }

      const signed = adjustment.reason_code_code === 'CORR_DOWN' ? -adjustment.quantity : adjustment.quantity
      snackbar.success(
        `${adjustment.number} posted`,
        `${adjustment.sku_number} corrected by ${formatSigned(signed)} units at ${adjustment.warehouse_name}.`,
      )
    },
  })
}

/**
 * Post a draft that already exists — F25 and F23's second half.
 *
 * The screens create and post together, so a draft only ever exists because
 * the post half failed, or because somebody prepared one through the API.
 * Either way it is a numbered document that has moved no stock, and leaving
 * it with no way to commit it makes it a dead end.
 *
 * No approval step and no second role: AsOne's matrix guards preparing and
 * posting with the same cell, so whoever prepared it may commit it. Who signs
 * off a large movement is their open question Q10, not something invented
 * here.
 */
export function usePostDraftAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => adjustmentsApi.postAdjustment(id),
    onSuccess: (adjustment) => {
      invalidateStock(queryClient)
      snackbar.success(
        `${adjustment.number} posted`,
        `${adjustment.reason_code_name} — ${adjustment.quantity} units of ${adjustment.sku_number} at ${adjustment.warehouse_name}.`,
      )
    },
  })
}

export function usePostDraftTransfer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => adjustmentsApi.postTransfer(id),
    onSuccess: (transfer) => {
      invalidateStock(queryClient)
      const units = transfer.lines.reduce((sum, line) => sum + line.quantity, 0)
      snackbar.success(
        `${transfer.number} posted`,
        `${units} units moved from ${transfer.from_warehouse_name} to ${transfer.to_warehouse_name}.`,
      )
    },
  })
}

/** Create then post a transfer, same reasoning as usePostAdjustment. */
export function usePostTransfer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: adjustmentsApi.TransferInput) => {
      const draft = await adjustmentsApi.createTransfer(input)
      try {
        return await adjustmentsApi.postTransfer(draft.id)
      } catch (error) {
        throw new DraftLeftBehind(draft.number, error)
      }
    },
    onSuccess: (transfer) => {
      invalidateStock(queryClient)
      const units = transfer.lines.reduce((sum, line) => sum + line.quantity, 0)
      snackbar.success(
        `${transfer.number} posted`,
        `${units} units moved from ${transfer.from_warehouse_name} to ${transfer.to_warehouse_name}. Total stock value is unchanged.`,
      )
    },
  })
}
