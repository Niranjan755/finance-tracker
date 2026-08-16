import { useMemo } from 'react'
import { todayISODate } from '@/lib/date'
import { computeBudgetAlerts, computeUpcomingPaymentAlerts } from '@/lib/finance/alerts'
import { useFinanceStore } from '@/store/financeStore'

/** Active budget/bill alerts, respecting the user's notification toggles in Settings. */
export function useAlerts() {
  const budgets = useFinanceStore((s) => s.budgets)
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const accounts = useFinanceStore((s) => s.accounts)
  const recurring = useFinanceStore((s) => s.recurring)
  const currency = useFinanceStore((s) => s.settings.currency)
  const notifications = useFinanceStore((s) => s.settings.notifications)

  const budgetAlerts = useMemo(
    () =>
      notifications.budgetAlerts
        ? computeBudgetAlerts(budgets, transactions, categories, accounts, currency, todayISODate())
        : [],
    [notifications.budgetAlerts, budgets, transactions, categories, accounts, currency],
  )

  const paymentAlerts = useMemo(
    () =>
      notifications.upcomingPayments
        ? computeUpcomingPaymentAlerts(recurring, todayISODate())
        : [],
    [notifications.upcomingPayments, recurring],
  )

  return { budgetAlerts, paymentAlerts, count: budgetAlerts.length + paymentAlerts.length }
}
