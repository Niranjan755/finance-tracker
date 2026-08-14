import { addDays, addMonths, format, startOfDay, startOfMonth } from 'date-fns'
import { parseISODate, toISODate } from '@/lib/date'
import type { Account, Transaction } from '@/types'
import { netWorthAsOf } from './calculations'

export type DateRangePreset = '7d' | '30d' | '3m' | '6m' | '1y' | 'custom'

export interface DateRange {
  startISO: string
  endISO: string
}

export function rangeFromPreset(
  preset: DateRangePreset,
  today = new Date(),
  custom?: DateRange,
): DateRange {
  if (preset === 'custom' && custom) return custom
  const end = startOfDay(today)
  const days: Record<Exclude<DateRangePreset, 'custom'>, number> = {
    '7d': 7,
    '30d': 30,
    '3m': 90,
    '6m': 182,
    '1y': 365,
  }
  const span = days[preset as Exclude<DateRangePreset, 'custom'>] ?? 30
  return { startISO: toISODate(addDays(end, -span + 1)), endISO: toISODate(end) }
}

export interface MonthlyIncomeExpensePoint {
  monthKey: string
  label: string
  incomeCents: number
  expenseCents: number
}

/** Income vs expense, bucketed by calendar month, for the last `months` months up to and including the month containing `endISO`. */
export function computeIncomeVsExpenseSeries(
  transactions: Transaction[],
  endISO: string,
  months: number,
): MonthlyIncomeExpensePoint[] {
  const end = parseISODate(endISO)
  const buckets: MonthlyIncomeExpensePoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = addMonths(startOfMonth(end), -i)
    buckets.push({
      monthKey: format(monthDate, 'yyyy-MM'),
      label: format(monthDate, 'MMM'),
      incomeCents: 0,
      expenseCents: 0,
    })
  }
  const byKey = new Map(buckets.map((b) => [b.monthKey, b]))
  for (const t of transactions) {
    const key = t.date.slice(0, 7)
    const bucket = byKey.get(key)
    if (!bucket) continue
    if (t.type === 'income') bucket.incomeCents += t.amountCents
    else bucket.expenseCents += t.amountCents
  }
  return buckets
}

export interface SpendingTrendPoint {
  dateISO: string
  label: string
  expenseCents: number
}

/** Daily spending total across the given date range (inclusive). */
export function computeSpendingTrend(
  transactions: Transaction[],
  range: DateRange,
): SpendingTrendPoint[] {
  const start = parseISODate(range.startISO)
  const end = parseISODate(range.endISO)
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  const points: SpendingTrendPoint[] = Array.from({ length: Math.max(dayCount, 0) }, (_, i) => {
    const d = addDays(start, i)
    return {
      dateISO: toISODate(d),
      label: format(d, dayCount > 60 ? 'MMM d' : 'MMM d'),
      expenseCents: 0,
    }
  })
  const byDate = new Map(points.map((p) => [p.dateISO, p]))
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    const point = byDate.get(t.date)
    if (point) point.expenseCents += t.amountCents
  }
  return points
}

export interface NetWorthTrendPoint {
  monthKey: string
  label: string
  netWorthCents: number
}

/** Net worth at the end of each of the last `months` months. */
export function computeNetWorthTrend(
  accounts: Account[],
  transactions: Transaction[],
  endISO: string,
  months: number,
): NetWorthTrendPoint[] {
  const end = parseISODate(endISO)
  const points: NetWorthTrendPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = addMonths(startOfMonth(end), -i)
    const monthEndISO = toISODate(addDays(addMonths(monthDate, 1), -1))
    const clampedISO = monthEndISO > endISO ? endISO : monthEndISO
    points.push({
      monthKey: format(monthDate, 'yyyy-MM'),
      label: format(monthDate, 'MMM yyyy'),
      netWorthCents: netWorthAsOf(accounts, transactions, clampedISO),
    })
  }
  return points
}

export interface AccountBalancePoint {
  monthKey: string
  label: string
  balances: Record<string, number>
}

/** Per-account balance at the end of each of the last `months` months (assets shown positive, liabilities as owed amount). */
export function computeAccountBalanceTrend(
  accounts: Account[],
  transactions: Transaction[],
  endISO: string,
  months: number,
): AccountBalancePoint[] {
  const end = parseISODate(endISO)
  const points: AccountBalancePoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = addMonths(startOfMonth(end), -i)
    const monthEndISO = toISODate(addDays(addMonths(monthDate, 1), -1))
    const clampedISO = monthEndISO > endISO ? endISO : monthEndISO
    const balances: Record<string, number> = {}
    for (const account of accounts) {
      balances[account.id] = balanceAsOf(account, transactions, clampedISO)
    }
    points.push({
      monthKey: format(monthDate, 'yyyy-MM'),
      label: format(monthDate, 'MMM yyyy'),
      balances,
    })
  }
  return points
}

function balanceAsOf(account: Account, transactions: Transaction[], asOfISO: string): number {
  let balance = account.balanceCents
  for (const t of transactions) {
    if (t.accountId !== account.id) continue
    if (t.date <= asOfISO) continue
    // Roll back transactions that happened after the as-of date.
    const isLiability = account.type === 'credit_card'
    const delta =
      t.type === 'expense'
        ? isLiability
          ? t.amountCents
          : -t.amountCents
        : isLiability
          ? -t.amountCents
          : t.amountCents
    balance -= delta
  }
  return balance
}
