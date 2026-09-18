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
import { SetPasswordScreen } from '@/features/auth/screens/SetPasswordScreen'
import { SignInScreen } from '@/features/auth/screens/SignInScreen'
import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen'
import { HomeScreen } from '@/features/dashboard/screens/HomeScreen'
import { ReportsIndexScreen } from '@/features/reports/screens/ReportsIndexScreen'
import { PriceListScreen } from '@/features/reports/screens/PriceListScreen'
import { StockReportScreen } from '@/features/reports/screens/StockReportScreen'
import { PlaceOrderScreen } from '@/features/orders/screens/PlaceOrderScreen'
import { OrderDetailScreen } from '@/features/orders/screens/OrderDetailScreen'
import { OrdersListScreen } from '@/features/orders/screens/OrdersListScreen'
import { UsersRolesScreen } from '@/features/users/screens/UsersRolesScreen'
import { CreateProductionOrderScreen } from '@/features/production/screens/CreateProductionOrderScreen'
import { ProductionOrderDetailScreen } from '@/features/production/screens/ProductionOrderDetailScreen'
import { UserProfileScreen } from '@/features/users/screens/UserProfileScreen'
import { CreateKitScreen } from '@/features/kits/screens/CreateKitScreen'
import { EditKitScreen } from '@/features/kits/screens/EditKitScreen'
import { KitDetailScreen } from '@/features/kits/screens/KitDetailScreen'
import { KitsScreen } from '@/features/kits/screens/KitsScreen'
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
import {
  canMoveStockBetweenWarehouses,
  canReadKits,
  canReadSchoolOrders,
} from '@/domain/access'
import { InventoryScreen } from '@/features/inventory/screens/InventoryScreen'
import { StockHistoryScreen } from '@/features/inventory/screens/StockHistoryScreen'
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
  '/inventory': InventoryScreen,
  '/stock-history': StockHistoryScreen,
  '/schools': SchoolsScreen,
  '/warehouses': WarehousesScreen,
  '/tailoring-centers': TailoringCentersScreen,
  '/receiving': ReceivingScreen,
  '/production-orders': ProductionOrdersScreen,
  '/backorders': BackordersScreen,
  '/users': UsersRolesScreen,
  '/adjustments': AdjustmentsScreen,
  '/kits': KitsScreen,
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
          {/* Outside RequireAuth's guard: a gated user is redirected here by
              it, so guarding this route with it would be a loop. The screen
              checks the session itself. */}
          <Route path={paths.setPassword} element={<SetPasswordScreen />} />
          <Route path={paths.createAccount} element={<CreateAccountScreen />} />

          {/*
            Detail screens that hang off a nav destination rather than being
            one. They are listed before the generated routes so a more
            specific path is matched first.
          */}
          {/*
            Before the :orderId route, or "new" is parsed as an order id.

            Gated on `school_orders`, which is narrower than the list it is
            reached from: the leads and Finance may *read* every order, but
            AsOne's matrix leaves School Orders Entry to school staff alone.
          */}
          <Route
            path="/orders/new"
            element={
              <RequireAuth>
                <RequireAccess requires="school_orders">
                  <PlaceOrderScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

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
          {/*
            Before the generated /kits route, so "new" is not parsed as a kit
            id. Both are gated on `table_updates`, wider than the read gate on
            the list: a school clerk reads kits to order from them and never
            builds one.
          */}
          <Route
            path="/kits/new"
            element={
              <RequireAuth>
                <RequireAccess requires="table_updates">
                  <CreateKitScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          {/* Managing an account is the Table Updates column, same as the
              list it is reached from. */}
          <Route
            path="/users/:userId"
            element={
              <RequireAuth>
                <RequireAccess requires="table_updates">
                  <UserProfileScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          {/* Before /kits/:kitId, or "3/edit" never matches. */}
          <Route
            path="/kits/:kitId/edit"
            element={
              <RequireAuth>
                <RequireAccess requires="table_updates">
                  <EditKitScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          <Route
            path="/kits/:kitId"
            element={
              <RequireAuth>
                <RequireAccess requires={canReadKits}>
                  <KitDetailScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          <Route
            path="/transfers/new"
            element={
              <RequireAuth>
                <RequireAccess requires={canMoveStockBetweenWarehouses}>
                  <NewTransferScreen />
                </RequireAccess>
              </RequireAuth>
            }
          />

          <Route
            path="/transfers"
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

          {/*
            Pricing's own report. Guarded on `financial_reports`, the column
            that opens the Reports destination and the Pricing category
            within it — not on `table_updates`, which is who may *set* a
            price rather than who may read the list.
          */}
          <Route
            path="/reports/price-list"
            element={
              <RequireAuth>
                <RequireAccess requires="financial_reports">
                  <PriceListScreen />
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
