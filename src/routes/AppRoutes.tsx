/**
 * Routes.
 *
 * Sign-in is one route covering both steps: password, then the emailed code.
 * A separate URL for the code step could be landed on with no challenge to
 * answer.
 *
 * Every sidebar destination is registered here, generated from the same
 * navigation model the sidebar draws from — so a link can never point at a
 * route that does not exist, and adding a destination is one entry in one
 * file. Screens that are built are listed in SCREENS; the rest get the
 * placeholder until their design arrives.
 *
 * Each is wrapped twice, and the order matters: RequireAuth first, because
 * "who are you" precedes "may you do this", and RequireAccess second so it
 * can rely on there being a user to ask about.
 */

import type { ComponentType } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { queryClient } from '@/api/queryClient'
import { SnackbarProvider } from '@/components'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { NavGroupsProvider } from '@/features/shell/NavGroupsProvider'
import { WarehouseFilterProvider } from '@/features/shell/WarehouseFilterProvider'
import { CreateAccountScreen } from '@/features/auth/screens/CreateAccountScreen'
import { SignInScreen } from '@/features/auth/screens/SignInScreen'
import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen'
import { HomeScreen } from '@/features/dashboard/screens/HomeScreen'
import { ReportsIndexScreen } from '@/features/reports/screens/ReportsIndexScreen'
import { StockReportScreen } from '@/features/reports/screens/StockReportScreen'
import { OrderDetailScreen } from '@/features/orders/screens/OrderDetailScreen'
import { OrdersListScreen } from '@/features/orders/screens/OrdersListScreen'
import { UserDetailScreen } from '@/features/users/screens/UserDetailScreen'
import { UsersRolesScreen } from '@/features/users/screens/UsersRolesScreen'
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen'
import { CreateProductionOrderScreen } from '@/features/production/screens/CreateProductionOrderScreen'
import { ProductionOrderDetailScreen } from '@/features/production/screens/ProductionOrderDetailScreen'
import { AdjustmentsScreen } from '@/features/adjustments/screens/AdjustmentsScreen'
import { NewAdjustmentScreen } from '@/features/adjustments/screens/NewAdjustmentScreen'
import { NewTransferScreen } from '@/features/adjustments/screens/NewTransferScreen'
import { TransfersScreen } from '@/features/adjustments/screens/TransfersScreen'
import { BackordersScreen } from '@/features/backorders/screens/BackordersScreen'
import { ProductionOrdersScreen } from '@/features/production/screens/ProductionOrdersScreen'
import { ReceivingScreen } from '@/features/receiving/screens/ReceivingScreen'
import { ShipmentDetailScreen } from '@/features/shipments/screens/ShipmentDetailScreen'
import { PickingScreen } from '@/features/shipments/screens/PickingScreen'
import { ShipmentsScreen } from '@/features/shipments/screens/ShipmentsScreen'
import { canMoveStockBetweenWarehouses, canReadSchoolOrders } from '@/domain/access'
import { SchoolDetailScreen } from '@/features/catalog/screens/SchoolDetailScreen'
import { SchoolsScreen } from '@/features/catalog/screens/SchoolsScreen'
import { WarehouseDetailScreen } from '@/features/catalog/screens/WarehouseDetailScreen'
import { WarehousesScreen } from '@/features/catalog/screens/WarehousesScreen'
import { TailoringCentersScreen } from '@/features/catalog/screens/TailoringCentersScreen'
import { ALL_NAV_ITEMS } from '@/features/shell/navigation'
import { PlaceholderScreen } from '@/features/shell/screens/PlaceholderScreen'
import { RequireAccess } from './RequireAccess'
import { RequireAuth } from './RequireAuth'
import { paths } from './paths'

/**
 * Built screens, by the path they answer. Anything absent falls through to
 * the placeholder, so this list is the honest record of what exists.
 */
const SCREENS: Record<string, ComponentType> = {
  // HomeScreen, not DashboardScreen: a school gets a different dashboard
  // behind the same path — see features/dashboard/screens/HomeScreen.tsx.
  '/dashboard': HomeScreen,
  '/reports': ReportsIndexScreen,
  '/orders': OrdersListScreen,
  '/schools': SchoolsScreen,
  '/warehouses': WarehousesScreen,
  '/tailoring-centers': TailoringCentersScreen,
  '/receiving': ReceivingScreen,
  '/production-orders': ProductionOrdersScreen,
  '/backorders': BackordersScreen,
  '/users': UsersRolesScreen,
  '/adjustments': AdjustmentsScreen,
  '/settings': SettingsScreen,
  // The landing view is the picking backlog; despatched shipments are the
  // history behind it.
  '/shipments': PickingScreen,
}

export function AppRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Outside the router: a message raised during a redirect should
          survive the navigation that caused it. */}
      <SnackbarProvider>
        <BrowserRouter>
        <AuthProvider>
          {/* Inside AuthProvider: the filter's options depend on the role,
              and a warehouse-scoped user has no choice to offer. */}
          <WarehouseFilterProvider>
            {/* Above the routes: the sidebar is rendered inside each screen,
                so anything held in it is lost on every navigation. */}
            <NavGroupsProvider>
              <Routes>
          <Route path={paths.welcome} element={<WelcomeScreen />} />
          <Route path={paths.signIn} element={<SignInScreen />} />
          <Route path={paths.createAccount} element={<CreateAccountScreen />} />

          {/*
            Detail screens that hang off a nav destination rather than being
            one. They are listed before the generated routes so a more
            specific path is matched first.
          */}
          <Route
            path="/orders/:orderId"
            element={
              <RequireAuth>
                <RequireAccess requires={canReadSchoolOrders}>
                  <OrderDetailScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          {/* Before the :orderId route, or "new" is parsed as an order id. */}
          <Route
            path="/shipments/history"
            element={
              <RequireAuth>
                <RequireAccess requires="warehouse_receiving_and_shipping">
                  <ShipmentsScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          <Route
            path="/shipments/:shipmentId"
            element={
              <RequireAuth>
                <RequireAccess requires="warehouse_receiving_and_shipping">
                  <ShipmentDetailScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          {/*
            Transfers before /adjustments/new, and both before the generated
            /adjustments route, so the more specific path is matched first.

            The transfer routes are guarded on `stock_transfers`, not
            `inventory_adjustments`: F25 gives transfers to both leads as well
            as Finance, where the adjustment screens are Finance alone. Gating
            them together would deny the leads a feature the matrix grants.
          */}
          <Route
            path="/adjustments/transfers/new"
            element={
              <RequireAuth>
                <RequireAccess requires={canMoveStockBetweenWarehouses}>
                  <NewTransferScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          <Route
            path="/adjustments/transfers"
            element={
              <RequireAuth>
                <RequireAccess requires={canMoveStockBetweenWarehouses}>
                  <TransfersScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          <Route
            path="/adjustments/new"
            element={
              <RequireAuth>
                <RequireAccess requires="inventory_adjustments">
                  <NewAdjustmentScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          <Route
            path="/production-orders/new"
            element={
              <RequireAuth>
                <RequireAccess requires="production_orders">
                  <CreateProductionOrderScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          <Route
            path="/production-orders/:orderId"
            element={
              <RequireAuth>
                <RequireAccess requires="production_orders">
                  <ProductionOrderDetailScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          <Route
            path="/reports/inventory"
            element={
              <RequireAuth>
                <RequireAccess requires={null}>
                  <StockReportScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          {ALL_NAV_ITEMS.map((item) => {
            const Screen = SCREENS[item.path] ?? PlaceholderScreen
            return (
              <Route
                key={item.path}
                path={item.path}
                element={
                  <RequireAuth>
                    <RequireAccess requires={item.requires}>
                      <Screen />
                    </RequireAccess>
                  </RequireAuth>
                }
              />
            )
          })}

          {/*
            The school detail screen is reached from the Schools list, not
            the sidebar, so it is not an entry in `navigation.ts` and is not
            covered by the loop above. It still needs the same guard as
            `/schools` itself: `table_updates`. Add and edit are both a modal
            on this screen and on the list — see `AddSchoolModal` — not
            separate routes, so there is only this one to add.
          */}
          <Route
            path="/schools/:id"
            element={
              <RequireAuth>
                <RequireAccess requires="table_updates">
                  <SchoolDetailScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          {/*
            Reached from the Warehouses list's "View Dashboard", not the
            sidebar — same reasoning and same guard as `/schools/:id` above.
          */}
          <Route
            path="/warehouses/:id"
            element={
              <RequireAuth>
                <RequireAccess requires="table_updates">
                  <WarehouseDetailScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          {/*
            Reached from a Users row, not the sidebar — same reasoning and
            same guard as `/schools/:id` above.
          */}
          <Route
            path="/users/:id"
            element={
              <RequireAuth>
                <RequireAccess requires="table_updates">
                  <UserDetailScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

              <Route path="*" element={<Navigate to={paths.welcome} replace />} />
              </Routes>
            </NavGroupsProvider>
          </WarehouseFilterProvider>
        </AuthProvider>
        </BrowserRouter>
      </SnackbarProvider>
    </QueryClientProvider>
  )
}
