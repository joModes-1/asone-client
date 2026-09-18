/**
 * One SKU's recent ledger entries — the ledger already exists (F48); this
 * just narrows it to one SKU for the detail panel.
 */

import { useQuery } from '@tanstack/react-query'
import * as inventoryApi from '@/api/inventory'
import { keys } from '@/api/keys'

export function useSkuMovements(skuId: number | null) {
  const { data, isLoading } = useQuery({
    queryKey: keys.skuMovements(skuId ?? -1),
    queryFn: () => inventoryApi.movements({ sku: skuId ?? undefined, page_size: 5 }),
    enabled: skuId !== null,
  })

  return { movements: data?.results ?? [], isLoading }
}
