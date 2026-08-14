import { addDays } from 'date-fns'
import { getMonthBounds, parseISODate, toISODate, type MonthBounds } from '@/lib/date'
import { formatCurrency, percentOf } from '@/lib/money'
import type { Account, Category, Currency, Transaction } from '@/types'
import { computeCategoryBreakdown, computeMonthlyStatement, netWorthAsOf } from './calculations'

export interface Insight {
  id: string
  text: string
}

function previousMonthBounds(bounds: MonthBounds): MonthBounds {
  const prevMonth = bounds.month === 1 ? 12 : bounds.month - 1
  const prevYear = bounds.month === 1 ? bounds.year - 1 : bounds.year
  return getMonthBounds(prevYear, prevMonth)
}

/**
 * Computes insight strings purely from stored transaction/account data.
 * Every insight is guarded so it only appears when the comparison is
 * mathematically meaningful (e.g. no "50% more" claims against a $0 base).
 */
export function computeInsights(
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
  currency: Currency,
  asOfISO: string,
): Insight[] {
  const insights: Insight[] = []
  const asOfDate = parseISODate(asOfISO)
  const bounds = getMonthBounds(asOfDate.getFullYear(), asOfDate.getMonth() + 1)
  const prevBounds = previousMonthBounds(bounds)

  const current = computeMonthlyStatement(accounts, transactions, [], bounds)
  const previous = computeMonthlyStatement(accounts, transactions, [], prevBounds)

  // Largest expense this month.
  if (current.largestExpense) {
    insights.push({
      id: 'largest-expense',
      text: `Your largest expense this month was ${current.largestExpense.merchant || 'a transaction'}: ${formatCurrency(current.largestExpense.amountCents, currency)}.`,
    })
  }

  // Highest spending category this month.
  const currentBreakdown = computeCategoryBreakdown(current.expenseTransactions, categories, 'expense')
  if (currentBreakdown.length > 0 && current.totalExpenseCents > 0) {
    const top = currentBreakdown[0]!
    insights.push({
      id: 'highest-category',
      text: `${top.name} represents ${top.percent}% of your spending this month.`,
    })
  }

  // Category-over-category comparison (only when last month had spending in that category).
  const previousBreakdown = computeCategoryBreakdown(previous.expenseTransactions, categories, 'expense')
  const previousByCategory = new Map(previousBreakdown.map((e) => [e.categoryId, e.amountCents]))
  for (const entry of currentBreakdown.slice(0, 3)) {
    const prevAmount = previousByCategory.get(entry.categoryId)
    if (!prevAmount || prevAmount <= 0) continue
    const changePercent = percentOf(entry.amountCents - prevAmount, prevAmount)
    if (Math.abs(changePercent) < 5) continue
    insights.push({
      id: `category-change-${entry.categoryId}`,
      text: `You spent ${Math.abs(changePercent).toFixed(0)}% ${changePercent > 0 ? 'more' : 'less'} on ${entry.name} than last month.`,
    })
  }

  // Savings comparison month over month.
  if (previous.transactionCount > 0) {
    const diff = current.netCashFlowCents - previous.netCashFlowCents
    if (Math.abs(diff) >= 100) {
      insights.push({
        id: 'savings-comparison',
        text:
          diff >= 0
            ? `You saved ${formatCurrency(diff, currency)} more than last month.`
            : `You saved ${formatCurrency(Math.abs(diff), currency)} less than last month.`,
      })
    }
  }

  // Average daily spending this month, based on days elapsed so far.
  const daysElapsed = Math.min(asOfDate.getDate(), 28)
  if (current.totalExpenseCents > 0 && daysElapsed > 0) {
    const avgDaily = Math.round(current.totalExpenseCents / daysElapsed)
    insights.push({
      id: 'avg-daily-spending',
      text: `Your average daily spending this month is ${formatCurrency(avgDaily, currency)}.`,
    })
  }

  // Net worth change this month (guarded against a zero or unknown starting base).
  const dayBeforeMonthStart = toISODate(addDays(parseISODate(bounds.startISO), -1))
  const startOfMonthNetWorth = netWorthAsOf(accounts, transactions, dayBeforeMonthStart)
  if (startOfMonthNetWorth !== 0) {
    const currentNetWorth = netWorthAsOf(accounts, transactions, asOfISO)
    const changePercent = percentOf(currentNetWorth - startOfMonthNetWorth, Math.abs(startOfMonthNetWorth))
    if (Math.abs(changePercent) >= 0.5) {
      insights.push({
        id: 'net-worth-change',
        text: `Your net worth ${changePercent >= 0 ? 'increased' : 'decreased'} ${Math.abs(changePercent).toFixed(1)}% this month.`,
      })
    }
  }

  return insights
}
