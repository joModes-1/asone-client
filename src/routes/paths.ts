/**
 * Route paths, in one place.
 *
 * Separate from AppRoutes so importing a path does not pull a component graph
 * with it — and so Fast Refresh keeps working on the routes file.
 *
 * The destinations the sidebar links to live in
 * `features/shell/navigation.ts`; as each screen is built its path moves
 * here and the two are reconciled.
 */

export const paths = {
  welcome: '/',
  signIn: '/sign-in',
  createAccount: '/create-account',
  dashboard: '/dashboard',
  schools: '/schools',
  schoolDetail: (id: number | string) => `/schools/${id}`,
  warehouses: '/warehouses',
  warehouseDetail: (id: number | string) => `/warehouses/${id}`,
  tailoringCenters: '/tailoring-centers',
  inventory: '/inventory',
  orders: '/orders',
  productionOrders: '/production-orders',
  stockReport: '/reports/inventory',
  receiving: '/receiving',
  backorders: '/backorders',
  users: '/users',
  userDetail: (id: number | string) => `/users/${id}`,
} as const
