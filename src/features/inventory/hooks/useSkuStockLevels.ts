/**
 * One SKU's stock at every warehouse the role may see — for the detail
 * panel's "Warehouse Locations" breakdown, which needs every site regardless
 * of whichever one the shell's top-bar filter currently has selected.
 */

import { useQuery } from '@tanstack/react-query'
import * as inventoryApi from '@/api/inventory'

export function useSkuStockLevels(skuId: number | null) {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-levels', 'by-sku', skuId],
    queryFn: () => inventoryApi.stockLevels({ include_zero: true }),
    enabled: skuId !== null,
  })

  return {
    stockLevels: (data ?? []).filter((row) => row.sku_id === skuId),
    isLoading,
  }
}
