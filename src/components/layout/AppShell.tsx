import { Outlet } from 'react-router-dom'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TransactionDialog } from '@/features/transactions/TransactionDialog'
import { AppSidebar } from './AppSidebar'
import { BottomNav } from './BottomNav'
import { Header } from './Header'

export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="flex-1 px-3 pb-24 pt-4 sm:px-6 md:pb-10">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
      <BottomNav />
      <TransactionDialog />
    </SidebarProvider>
  )
}
