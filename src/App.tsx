import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/AppShell'
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow'
import { useThemeSync } from '@/hooks/useThemeSync'
import { useFinanceStore } from '@/store/financeStore'
import { useAuthStore } from '@/store/authStore'
import { initSyncEngine } from '@/lib/sync/engine'

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const AccountsPage = lazy(() =>
  import('@/pages/AccountsPage').then((m) => ({ default: m.AccountsPage })),
)
const AccountDetailPage = lazy(() =>
  import('@/pages/AccountDetailPage').then((m) => ({ default: m.AccountDetailPage })),
)
const TransactionsPage = lazy(() =>
  import('@/pages/TransactionsPage').then((m) => ({ default: m.TransactionsPage })),
)
const BudgetsPage = lazy(() =>
  import('@/pages/BudgetsPage').then((m) => ({ default: m.BudgetsPage })),
)
const UpcomingPage = lazy(() =>
  import('@/pages/UpcomingPage').then((m) => ({ default: m.UpcomingPage })),
)
const ReportsPage = lazy(() =>
  import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
)
const CalendarPage = lazy(() =>
  import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

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
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
    </div>
  )
}

function AppContent() {
  const status = useFinanceStore((s) => s.status)
  const error = useFinanceStore((s) => s.error)
  const init = useFinanceStore((s) => s.init)
  const runDueRecurring = useFinanceStore((s) => s.runDueRecurring)
  const autoGenerateRecurring = useFinanceStore((s) => s.settings.autoGenerateRecurring)
  const onboardingComplete = useFinanceStore((s) => s.settings.onboardingComplete)
  useThemeSync()

  useEffect(() => {
    init()
    useAuthStore.getState()._init()
    initSyncEngine()
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
  if (!onboardingComplete) return <OnboardingFlow />

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/upcoming" element={<UpcomingPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
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
