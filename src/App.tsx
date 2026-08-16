import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { AppShell } from '@/components/layout/AppShell'
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow'
import { RecurringCatchUpDialog } from '@/features/recurring/RecurringCatchUpDialog'
import { useThemeSync } from '@/hooks/useThemeSync'
import { useFinanceStore } from '@/store/financeStore'
import { useAuthStore } from '@/store/authStore'
import { initSyncEngine } from '@/lib/sync/engine'
import type { DueRecurringEntry } from '@/lib/finance/recurringProjection'
import { computeBudgetAlerts, computeUpcomingPaymentAlerts } from '@/lib/finance/alerts'
import { computeMonthlyStatement } from '@/lib/finance/calculations'
import { isDateInRange, listRecentMonths, monthKey, todayISODate } from '@/lib/date'
import { formatCurrency } from '@/lib/money'

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
  const navigate = useNavigate()
  const status = useFinanceStore((s) => s.status)
  const error = useFinanceStore((s) => s.error)
  const init = useFinanceStore((s) => s.init)
  const accounts = useFinanceStore((s) => s.accounts)
  const runDueRecurring = useFinanceStore((s) => s.runDueRecurring)
  const previewDueRecurring = useFinanceStore((s) => s.previewDueRecurring)
  const autoGenerateRecurring = useFinanceStore((s) => s.settings.autoGenerateRecurring)
  const onboardingComplete = useFinanceStore((s) => s.settings.onboardingComplete)
  const [catchUpEntries, setCatchUpEntries] = useState<DueRecurringEntry[]>([])
  const hasShownAlertsRef = useRef(false)
  useThemeSync()

  async function postDueRecurring() {
    const count = await runDueRecurring()
    if (count > 0 && useFinanceStore.getState().settings.notifications.recurringTransactions) {
      toast.success(`Posted ${count} recurring transaction${count === 1 ? '' : 's'}`)
    }
  }

  useEffect(() => {
    init()
    useAuthStore.getState()._init()
    initSyncEngine()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status === 'ready' && autoGenerateRecurring) {
      const due = previewDueRecurring()
      const hasBacklog = due.some((entry) => entry.occurrences.length > 1)
      if (hasBacklog) {
        setCatchUpEntries(due)
      } else {
        postDueRecurring()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, autoGenerateRecurring])

  // Once-per-app-load summary of anything that needs the user's attention:
  // over/near-limit budgets, bills due soon, and (once a month) a recap of
  // last month. Reads live state via getState() rather than reactive
  // selectors so it fires exactly once on load, not on every later edit.
  useEffect(() => {
    if (status !== 'ready' || hasShownAlertsRef.current) return
    hasShownAlertsRef.current = true

    const state = useFinanceStore.getState()
    const { notifications, currency } = state.settings
    const today = todayISODate()

    const budgetAlerts = notifications.budgetAlerts
      ? computeBudgetAlerts(state.budgets, state.transactions, state.categories, state.accounts, currency, today)
      : []
    if (budgetAlerts.length > 0) {
      toast(`${budgetAlerts.length} budget${budgetAlerts.length === 1 ? '' : 's'} need attention`, {
        description: budgetAlerts.map((a) => a.category?.name ?? 'Uncategorized').join(', '),
      })
    }

    const paymentAlerts = notifications.upcomingPayments
      ? computeUpcomingPaymentAlerts(state.recurring, today)
      : []
    if (paymentAlerts.length > 0) {
      toast(`${paymentAlerts.length} bill${paymentAlerts.length === 1 ? '' : 's'} due soon`, {
        description: paymentAlerts.map((a) => a.recurring.name).join(', '),
      })
    }

    if (notifications.monthlyReports) {
      const thisMonthKey = monthKey(today)
      if (state.settings.lastMonthlyReportMonth !== thisMonthKey) {
        const lastMonthBounds = listRecentMonths(2)[1]
        if (lastMonthBounds) {
          const hasData = state.transactions.some((t) =>
            isDateInRange(t.date, lastMonthBounds.startISO, lastMonthBounds.endISO),
          )
          if (hasData) {
            const statement = computeMonthlyStatement(
              state.accounts,
              state.transactions,
              state.transfers,
              lastMonthBounds,
              currency,
            )
            toast(`${lastMonthBounds.label} summary`, {
              description: `${formatCurrency(statement.totalIncomeCents, currency)} in, ${formatCurrency(statement.totalExpenseCents, currency)} out`,
            })
          }
        }
        state.updateSettings({ lastMonthlyReportMonth: thisMonthKey })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

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
      <RecurringCatchUpDialog
        open={catchUpEntries.length > 0}
        entries={catchUpEntries}
        accounts={accounts}
        onRecordAll={() => {
          setCatchUpEntries([])
          postDueRecurring()
        }}
        onReviewEach={() => {
          setCatchUpEntries([])
          navigate('/upcoming')
        }}
        onCancel={() => setCatchUpEntries([])}
      />
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
