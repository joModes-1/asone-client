/**
 * Resolves a navigation icon name to a glyph.
 *
 * Lucide is already a dependency and its glyphs match the design's icons
 * closely — the design pulls from a dozen different Iconify sets, and
 * carrying thirty exported SVGs for generic UI symbols would be a
 * maintenance cost for no visual gain.
 *
 * The one exception is the sewing machine for Tailoring Centers, which has
 * no Lucide equivalent, so that one is the exported asset.
 */

import {
  ArrowLeftRight,
  Boxes,
  Clock,
  Coins,
  FileBarChart,
  History,
  LayoutDashboard,
  Package,
  PackageOpen,
  Receipt,
  School,
  Settings,
  Shirt,
  SlidersHorizontal,
  Tags,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import sewingMachineUrl from '@/assets/icons/sewing-machine.svg'

/**
 * Every name `navigation.ts` asks for.
 *
 * Four were missing — History, Tags, Coins and ArrowLeftRight — and each fell
 * through to the `Boxes` default, so Inventory, Stock History, SKUs and
 * Pricing all wore the same glyph and the rail read as four copies of one
 * destination. A silent fallback is why nobody noticed: keep this in step
 * when adding a nav entry.
 */
const GLYPHS: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileBarChart,
  Package,
  PackageOpen,
  Truck,
  Receipt,
  SlidersHorizontal,
  ArrowLeftRight,
  Clock,
  Boxes,
  History,
  Shirt,
  Tags,
  Coins,
  School,
  Warehouse,
  Users,
  Settings,
}

export function NavIcon({ name, size = 20 }: { name: string; size?: number }) {
  if (name === 'SewingMachine') {
    return <img src={sewingMachineUrl} width={size} height={size} alt="" aria-hidden />
  }

  const Glyph = GLYPHS[name] ?? Boxes
  return <Glyph size={size} aria-hidden />
}
