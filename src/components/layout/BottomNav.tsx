import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  MoreHorizontal,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useUIStore } from '@/store/uiStore'
import { MOBILE_MORE_NAV, MOBILE_PRIMARY_NAV } from './navConfig'

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const openAddTransaction = useUIStore((s) => s.openAddTransaction)
  const location = useLocation()
  const isMoreSectionActive = MOBILE_MORE_NAV.some((item) => item.to === location.pathname)

  return (
    <>
      <nav
        aria-label="Primary"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MOBILE_PRIMARY_NAV.slice(0, 2).map((item) => (
          <BottomNavLink
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            end={item.to === '/'}
          />
        ))}

        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="Add transaction"
            onClick={() => setAddOpen(true)}
            className="bg-primary text-primary-foreground flex size-12 -translate-y-3 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
          >
            <Plus className="size-6" aria-hidden="true" />
          </button>
        </div>

        <BottomNavLink to="/accounts" label="Accounts" icon={MOBILE_PRIMARY_NAV[2]!.icon} />
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs',
            isMoreSectionActive ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
          More
        </button>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>More</DrawerTitle>
          </DrawerHeader>
          <div className="grid grid-cols-3 gap-2 px-4 pb-8">
            {MOBILE_MORE_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm',
                    isActive ? 'border-primary bg-primary/5 text-primary' : 'text-foreground',
                  )
                }
              >
                <item.icon className="size-5" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={addOpen} onOpenChange={setAddOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-8">
            <QuickAddButton
              icon={ArrowDownCircle}
              iconClassName="text-red-500"
              label="Add Expense"
              onClick={() => {
                setAddOpen(false)
                openAddTransaction('expense')
              }}
            />
            <QuickAddButton
              icon={ArrowUpCircle}
              iconClassName="text-emerald-500"
              label="Add Income"
              onClick={() => {
                setAddOpen(false)
                openAddTransaction('income')
              }}
            />
            <QuickAddButton
              icon={ArrowLeftRight}
              iconClassName="text-blue-500"
              label="Transfer Money"
              onClick={() => {
                setAddOpen(false)
                openAddTransaction('transfer')
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

function BottomNavLink({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )
      }
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </NavLink>
  )
}

function QuickAddButton({
  icon: Icon,
  iconClassName,
  label,
  onClick,
}: {
  icon: LucideIcon
  iconClassName?: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent flex items-center gap-3 rounded-lg border p-4 text-left text-sm font-medium transition-colors"
    >
      <Icon className={cn('size-5', iconClassName)} aria-hidden="true" />
      {label}
    </button>
  )
}
