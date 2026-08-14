import { useLocation } from 'react-router-dom'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { GlobalSearch } from './GlobalSearch'
import { ThemeToggle } from './ThemeToggle'
import { ALL_NAV } from './navConfig'

export function Header() {
  const location = useLocation()
  const current = ALL_NAV.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
  )

  return (
    <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur sm:px-4">
      <SidebarTrigger className="hidden md:flex" />
      <h1 className="text-base font-semibold md:text-lg">{current?.label ?? 'Finance Tracker'}</h1>
      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
        <ThemeToggle />
      </div>
    </header>
  )
}
