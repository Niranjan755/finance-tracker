import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Calendar,
  FileText,
  LayoutDashboard,
  Settings,
  Target,
  Wallet,
  ArrowLeftRight,
  CalendarClock,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export const SECONDARY_NAV: NavItem[] = [
  { to: '/upcoming', label: 'Upcoming', icon: CalendarClock },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV]

/** The four items pinned to the mobile bottom nav; a fifth "More" slot covers the rest. */
export const MOBILE_PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
]

export const MOBILE_MORE_NAV: NavItem[] = [
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/upcoming', label: 'Upcoming', icon: CalendarClock },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
]
