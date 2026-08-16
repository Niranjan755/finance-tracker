import { differenceInCalendarDays } from 'date-fns'
import { parseISODate } from '@/lib/date'
import type { Account, Budget, Category, Currency, RecurringTransaction, Transaction } from '@/types'
import { type BudgetProgress, computeBudgetProgressWithRollover } from './calculations'
import { projectAllOccurrences } from './recurringProjection'

export interface BudgetAlert {
  budget: Budget
  category: Category | undefined
  progress: BudgetProgress
}

/**
 * Budgets for the current month that are near or over their limit, using the
 * rollover-aware effective limit (computeBudgetProgressWithRollover) so a
 * budget topped up by unspent rollover isn't flagged as over just because
 * its raw amountCents alone would be exceeded.
 */
export function computeBudgetAlerts(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  targetCurrency: Currency,
  asOfISO: string,
): BudgetAlert[] {
  const [yearStr, monthStr] = asOfISO.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const progress = computeBudgetProgressWithRollover(
    budgets,
    transactions,
    categories,
    accounts,
    targetCurrency,
    month,
    year,
  )

  return progress
    .filter((p) => p.status === 'near-limit' || p.status === 'over-budget')
    .map((p) => ({ budget: p.budget, category: p.category, progress: p }))
}

export interface PaymentAlert {
  recurring: RecurringTransaction
  dueDate: string
  daysUntil: number
}

/**
 * The next due occurrence of each active recurring rule, limited to those
 * landing within `horizonDays` of `asOfISO`. Reuses the same projection used
 * by the Upcoming page, deduped to one (the soonest) entry per rule.
 */
export function computeUpcomingPaymentAlerts(
  recurring: RecurringTransaction[],
  asOfISO: string,
  horizonDays = 7,
): PaymentAlert[] {
  const occurrences = projectAllOccurrences(recurring, asOfISO, horizonDays)
  const recurringById = new Map(recurring.map((r) => [r.id, r]))
  const seen = new Set<string>()
  const alerts: PaymentAlert[] = []

  for (const occ of occurrences) {
    if (seen.has(occ.recurringId)) continue
    seen.add(occ.recurringId)
    const rule = recurringById.get(occ.recurringId)
    if (!rule) continue
    alerts.push({
      recurring: rule,
      dueDate: occ.date,
      daysUntil: differenceInCalendarDays(parseISODate(occ.date), parseISODate(asOfISO)),
    })
  }

  return alerts.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
