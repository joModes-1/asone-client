/**
 * Query keys.
 *
 * Plain arrays describing resource identity — no React here, which is why
 * they sit beside the resources they name rather than in a feature. Keeping
 * them central is what makes cross-feature invalidation possible: posting a
 * receipt has to invalidate stock levels, and the receipt code should not
 * have to guess how the inventory feature spelled its key.
 */

export const keys = {
  // Dashboard — all scoped by warehouse, so the filter is part of the key.
  summary: (warehouseId: number | null) => ['dashboard', 'summary', warehouseId] as const,
  attention: (warehouseId: number | null) => ['dashboard', 'attention', warehouseId] as const,
  activity: (warehouseId: number | null) => ['dashboard', 'activity', warehouseId] as const,
  orderVolume: (warehouseId: number | null) =>
    ['dashboard', 'order-volume', warehouseId] as const,
  notifications: (warehouseId: number | null) =>
    ['dashboard', 'notifications', warehouseId] as const,
  inventoryByWarehouse: (warehouseId: number | null) =>
    ['dashboard', 'inventory-by-warehouse', warehouseId] as const,

  stockLevels: (warehouseId: number | null) => ['stock-levels', warehouseId] as const,
  reorderAlerts: (warehouseId: number | null) => ['reorder-alerts', warehouseId] as const,
  movements: (warehouseId: number | null) => ['movements', warehouseId] as const,
  ordersOnHold: () => ['orders', 'on-hold'] as const,
  ordersPartProcessed: (warehouseId: number | null) =>
    ['orders', 'part-processed', warehouseId] as const,
  shipments: (warehouseId: number | null) => ['orders', 'shipments', warehouseId] as const,
  backorders: () => ['orders', 'backorders'] as const,
  schoolOrdersForSchool: (schoolId: number, page: number) =>
    ['orders', 'by-school', schoolId, page] as const,
  receipts: () => ['receipts'] as const,
  warehouses: () => ['warehouses'] as const,

  // Schools — master data, so the list is invalidated as a whole on any
  // write rather than patched row by row.
  schools: (
    level: string | null,
    warehouseId: number | null,
    isActive: boolean | null,
    page: number,
  ) => ['schools', level, warehouseId, isActive, page] as const,
  school: (id: number) => ['schools', 'detail', id] as const,

  // Warehouses and Tailoring Centers — master data, same reasoning as
  // Schools. `warehouses()` above stays as the unfiltered "options" key
  // pickers already use; these are the paginated list screen's own.
  warehousesList: (tailoringCenterId: number | null, page: number) =>
    ['warehouses', 'list', tailoringCenterId, page] as const,
  warehouse: (id: number) => ['warehouses', 'detail', id] as const,
  tailoringCenters: () => ['tailoring-centers'] as const,
  tailoringCentersList: (page: number) => ['tailoring-centers', 'list', page] as const,
  tailoringCenter: (id: number) => ['tailoring-centers', 'detail', id] as const,

  // Inventory & Products — SKUs, the garments and sizes they're built from,
  // and the per-warehouse reorder floor. Stock figures reuse `stockLevels`
  // above; these are the catalogue side of the screen.
  garments: () => ['garments'] as const,
  sizes: () => ['sizes'] as const,
  inventorySkus: (
    level: string | null,
    sizeId: number | null,
    isActive: boolean | null,
  ) => ['inventory', 'skus', level, sizeId, isActive] as const,
  minimumStockLevels: (warehouseId: number | null) =>
    ['minimum-stock-levels', warehouseId] as const,
  skuMovements: (skuId: number) => ['movements', 'by-sku', skuId] as const,
  shippedTotals: (warehouseId: number | null) => ['movements', 'shipped-totals', warehouseId] as const,

  // Users & Roles. `roles` is the fixed list of five and never changes, so
  // it can be cached hard; `users` changes whenever a lead adds somebody.
  users: (filters?: Record<string, unknown>) =>
    filters ? (['users', filters] as const) : (['users'] as const),
  user: (id: number) => ['users', id] as const,
  roles: () => ['roles'] as const,
  registrationRequests: (status?: string) =>
    status ? (['registration-requests', status] as const) : (['registration-requests'] as const),

  // Settings — the signed-in user. Invalidate after editing own details or
  // changing a password, since the password change returns fresh tokens.
  me: () => ['me'] as const,
} as const
