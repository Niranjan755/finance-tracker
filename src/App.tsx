import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/AppShell'
import { AccountDetailPage } from '@/pages/AccountDetailPage'
import { AccountsPage } from '@/pages/AccountsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { useThemeSync } from '@/hooks/useThemeSync'
import { useFinanceStore } from '@/store/financeStore'

function LoadingScreen() {
  return (
    <div className="flex min-h-svh flex-col gap-4 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="font-medium">Unable to load your data</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function AppContent() {
  const status = useFinanceStore((s) => s.status)
  const error = useFinanceStore((s) => s.error)
  const init = useFinanceStore((s) => s.init)
  const runDueRecurring = useFinanceStore((s) => s.runDueRecurring)
  const autoGenerateRecurring = useFinanceStore((s) => s.settings.autoGenerateRecurring)
  useThemeSync()

  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status === 'ready' && autoGenerateRecurring) {
      runDueRecurring()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, autoGenerateRecurring])

  if (status === 'error') return <ErrorScreen message={error ?? 'Something went wrong.'} />
  if (status !== 'ready') return <LoadingScreen />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <Toaster />
    </BrowserRouter>
  )
}

export default App
