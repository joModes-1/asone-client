/**
 * Uniform kit data.
 *
 * Kits are master data the leads maintain: a handful of rows that change a
 * few times a year, read by every school placing an order. So they are
 * cached hard and invalidated as a whole on any write — there is nothing to
 * gain from patching a single row into a list of six.
 */

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as kitsApi from '@/api/kits'
import { snackbar } from '@/components'
import type { KitItem } from '@/api/types'

const KITS_STALE = 5 * 60 * 1000

export function useKits() {
  return useQuery({
    queryKey: ['kits'],
    queryFn: () => kitsApi.kits({ page_size: 100 }),
    staleTime: KITS_STALE,
  })
}

export function useKit(id: number) {
  return useQuery({
    queryKey: ['kits', 'detail', id],
    queryFn: () => kitsApi.kit(id),
    enabled: Number.isFinite(id),
  })
}

/**
 * Every kit's components, in one request, grouped by kit.
 *
 * The list screen shows each kit's contents on its card, so it needs the
 * lines for all of them. AsOne has a handful of kits carrying a handful of
 * lines each, so one unfiltered request and a group here beats one request
 * per card — and the same cached response serves the detail screen.
 */
export function useKitComponents() {
  const query = useQuery({
    queryKey: ['kit-items'],
    queryFn: () => kitsApi.kitItems(),
    staleTime: KITS_STALE,
  })

  const byKit = useMemo(() => {
    const map = new Map<number, KitItem[]>()
    for (const item of query.data?.results ?? []) {
      const lines = map.get(item.kit)
      if (lines) lines.push(item)
      else map.set(item.kit, [item])
    }
    return map
  }, [query.data])

  return { ...query, byKit }
}

/** Everything a kit write could have changed. */
function invalidateKits(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['kits'] })
  void queryClient.invalidateQueries({ queryKey: ['kit-items'] })
  // A school's price list prints kit bundles, so it moves when a kit does.
  void queryClient.invalidateQueries({ queryKey: ['price-lists'] })
}

export function useCreateKit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: kitsApi.KitInput) => kitsApi.createKit(input),
    onSuccess: (kit) => {
      invalidateKits(queryClient)
      snackbar.success(
        `${kit.name} created`,
        'Add its components next — a kit with no components cannot be priced or ordered.',
      )
    },
  })
}

export function useUpdateKit(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Partial<kitsApi.KitInput>) => kitsApi.updateKit(id, input),
    onSuccess: (kit) => {
      invalidateKits(queryClient)
      snackbar.success(
        `${kit.name} saved`,
        kit.is_active
          ? undefined
          : 'It is now inactive, so no school can add it to a new order. Past orders are unaffected.',
      )
    },
  })
}

export function useAddKitItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { kit: number; sku: number; quantity: number }) =>
      kitsApi.addKitItem(input),
    onSuccess: () => invalidateKits(queryClient),
  })
}

export function useRemoveKitItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => kitsApi.removeKitItem(id),
    onSuccess: () => invalidateKits(queryClient),
  })
}
