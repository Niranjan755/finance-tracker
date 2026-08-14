import { isDateInRange, type MonthBounds } from '@/lib/date'
import { percentOf } from '@/lib/money'
import type { Account, Budget, Category, Currency, Transaction, Transfer } from '@/types'
import { isLiabilityAccountType } from './math'

export interface CurrencyTotals {
  currency: Currency
  totalAssetsCents: number
  totalLiabilitiesCents: number
  netWorthCents: number
  availableCashCents: number
  creditCardDebtCents: number
}

export interface AccountTotals {
  totalAssetsCents: number
  totalLiabilitiesCents: number
  netWorthCents: number
  availableCashCents: number
  creditCardDebtCents: number
  byCurrency: Record<Currency, CurrencyTotals>
}

const LIQUID_ASSET_TYPES: Account['type'][] = ['checking', 'savings', 'cash', 'debit_card']

export function computeAccountTotals(accounts: Account[]): AccountTotals {
  const byCurrency = {
    USD: { currency: 'USD', totalAssetsCents: 0, totalLiabilitiesCents: 0, netWorthCents: 0, availableCashCents: 0, creditCardDebtCents: 0 },
    INR: { currency: 'INR', totalAssetsCents: 0, totalLiabilitiesCents: 0, netWorthCents: 0, availableCashCents: 0, creditCardDebtCents: 0 },
    EUR: { currency: 'EUR', totalAssetsCents: 0, totalLiabilitiesCents: 0, netWorthCents: 0, availableCashCents: 0, creditCardDebtCents: 0 },
    GBP: { currency: 'GBP', totalAssetsCents: 0, totalLiabilitiesCents: 0, netWorthCents: 0, availableCashCents: 0, creditCardDebtCents: 0 },
    CAD: { currency: 'CAD', totalAssetsCents: 0, totalLiabilitiesCents: 0, netWorthCents: 0, availableCashCents: 0, creditCardDebtCents: 0 },
    AUD: { currency: 'AUD', totalAssetsCents: 0, totalLiabilitiesCents: 0, netWorthCents: 0, availableCashCents: 0, creditCardDebtCents: 0 },
  } satisfies Record<Currency, CurrencyTotals>

  let totalAssets = 0
  let totalLiabilities = 0
  let availableCash = 0
  let creditCardDebt = 0

  for (const account of accounts) {
    if (!account.isActive) continue
    const bucket = byCurrency[account.currency]

    if (isLiabilityAccountType(account.type)) {
      bucket.totalLiabilitiesCents += account.balanceCents
      totalLiabilities += account.balanceCents
      if (account.type === 'credit_card') {
        bucket.creditCardDebtCents += account.balanceCents
        creditCardDebt += account.balanceCents
      }
    } else {
      bucket.totalAssetsCents += account.balanceCents
      totalAssets += account.balanceCents
      if (LIQUID_ASSET_TYPES.includes(account.type)) {
        bucket.availableCashCents += account.balanceCents
        availableCash += account.balanceCents
      }
    }

    bucket.netWorthCents = bucket.totalAssetsCents - bucket.totalLiabilitiesCents
  }

  const totals = {
    totalAssetsCents: totalAssets,
    totalLiabilitiesCents: totalLiabilities,
    netWorthCents: totalAssets - totalLiabilities,
    availableCashCents: availableCash,
    creditCardDebtCents: creditCardDebt,
    byCurrency,
  }

  return totals
}

/**
 * Reconstructs total net worth as of the end of `asOfISO` by rolling back
 * every income/expense transaction dated after it. Transfers are excluded
 * on purpose: moving money between the user's own accounts never changes
 * net worth, so they need no adjustment here.
 */
export function netWorthAsOf(
  accounts: Account[],
  transactions: Transaction[],
  asOfISO: string,
): number {
  const current = computeAccountTotals(accounts).netWorthCents
  let adjustment = 0
  for (const t of transactions) {
    if (t.date > asOfISO) {
      adjustment += t.type === 'income' ? -t.amountCents : t.amountCents
    }
  }
  return current + adjustment
}

export interface MonthlyStatement {
  bounds: MonthBounds
  openingBalanceCents: number
  closingBalanceCents: number
  totalIncomeCents: number
  totalExpenseCents: number
  totalTransfersCents: number
  netCashFlowCents: number
  savingsRatePercent: number
  largestExpense: Transaction | null
  transactionCount: number
  incomeTransactions: Transaction[]
  expenseTransactions: Transaction[]
}

export function computeMonthlyStatement(
  accounts: Account[],
  transactions: Transaction[],
  transfers: Transfer[],
  bounds: MonthBounds,
): MonthlyStatement {
  const inMonth = transactions.filter((t) => isDateInRange(t.date, bounds.startISO, bounds.endISO))
  const incomeTransactions = inMonth.filter((t) => t.type === 'income')
  const expenseTransactions = inMonth.filter((t) => t.type === 'expense')
  const totalIncomeCents = incomeTransactions.reduce((sum, t) => sum + t.amountCents, 0)
  const totalExpenseCents = expenseTransactions.reduce((sum, t) => sum + t.amountCents, 0)
  const totalTransfersCents = transfers
    .filter((t) => isDateInRange(t.date, bounds.startISO, bounds.endISO))
    .reduce((sum, t) => sum + t.fromAmountCents, 0)

  const closingBalanceCents = netWorthAsOf(accounts, transactions, bounds.endISO)
  const openingBalanceCents = closingBalanceCents - totalIncomeCents + totalExpenseCents
  const netCashFlowCents = totalIncomeCents - totalExpenseCents
  const savingsRatePercent =
    totalIncomeCents === 0 ? 0 : percentOf(netCashFlowCents, totalIncomeCents)

  const largestExpense = expenseTransactions.reduce<Transaction | null>(
    (largest, t) => (!largest || t.amountCents > largest.amountCents ? t : largest),
    null,
  )

  return {
    bounds,
    openingBalanceCents,
    closingBalanceCents,
    totalIncomeCents,
    totalExpenseCents,
    totalTransfersCents,
    netCashFlowCents,
    savingsRatePercent,
    largestExpense,
    transactionCount: inMonth.length,
    incomeTransactions,
    expenseTransactions,
  }
}

export interface CategoryBreakdownEntry {
  categoryId: string
  name: string
  icon: string
  color: string
  amountCents: number
  percent: number
}

function topLevelCategoryId(category: Category): string {
  return category.parentId ?? category.id
}

/** Groups expense transactions by top-level category (Housing, Food, ...), sorted by spend desc. */
export function computeCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: Transaction['type'] = 'expense',
): CategoryBreakdownEntry[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map<string, number>()

  for (const t of transactions) {
    if (t.type !== type) continue
    const category = categoryById.get(t.categoryId)
    const key = category ? topLevelCategoryId(category) : t.categoryId
    totals.set(key, (totals.get(key) ?? 0) + t.amountCents)
  }

  const grandTotal = [...totals.values()].reduce((sum, v) => sum + v, 0)

  return [...totals.entries()]
    .map(([categoryId, amountCents]) => {
      const category = categoryById.get(categoryId)
      return {
        categoryId,
        name: category?.name ?? 'Uncategorized',
        icon: category?.icon ?? 'circle-dashed',
        color: category?.color ?? '#6b7280',
        amountCents,
        percent: percentOf(amountCents, grandTotal),
      }
    })
    .sort((a, b) => b.amountCents - a.amountCents)
}

export type BudgetStatus = 'normal' | 'warning' | 'near-limit' | 'over-budget'

export interface BudgetProgress {
  budget: Budget
  category: Category | undefined
  spentCents: number
  remainingCents: number
  percentUsed: number
  status: BudgetStatus
}

function categoryAndDescendantIds(categories: Category[], categoryId: string): Set<string> {
  const ids = new Set([categoryId])
  for (const c of categories) {
    if (c.parentId === categoryId) ids.add(c.id)
  }
  return ids
}

export function budgetStatusFor(percentUsed: number): BudgetStatus {
  if (percentUsed > 100) return 'over-budget'
  if (percentUsed > 90) return 'near-limit'
  if (percentUsed >= 75) return 'warning'
  return 'normal'
}

export function computeBudgetProgress(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
): BudgetProgress[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  return budgets.map((budget) => {
    const relevantIds = categoryAndDescendantIds(categories, budget.categoryId)
    const spentCents = transactions
      .filter((t) => t.type === 'expense' && relevantIds.has(t.categoryId))
      .filter((t) => {
        const [year, month] = t.date.split('-').map(Number)
        return year === budget.year && month === budget.month
      })
      .reduce((sum, t) => sum + t.amountCents, 0)

    const percentUsed = percentOf(spentCents, budget.amountCents)

    return {
      budget,
      category: categoryById.get(budget.categoryId),
      spentCents,
      remainingCents: budget.amountCents - spentCents,
      percentUsed,
      status: budgetStatusFor(percentUsed),
    }
  })
}

export interface CashFlow {
  moneyInCents: number
  moneyOutCents: number
  transfersCents: number
  netCashFlowCents: number
}

export function computeCashFlow(
  transactions: Transaction[],
  transfers: Transfer[],
  startISO: string,
  endISO: string,
): CashFlow {
  const inRange = transactions.filter((t) => isDateInRange(t.date, startISO, endISO))
  const moneyInCents = inRange
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amountCents, 0)
  const moneyOutCents = inRange
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amountCents, 0)
  const transfersCents = transfers
    .filter((t) => isDateInRange(t.date, startISO, endISO))
    .reduce((s, t) => s + t.fromAmountCents, 0)

  return {
    moneyInCents,
    moneyOutCents,
    transfersCents,
    netCashFlowCents: moneyInCents - moneyOutCents,
  }
}

export interface MerchantStat {
  merchant: string
  transactionCount: number
  totalSpentCents: number
}

export function computeMerchantStats(transactions: Transaction[]): MerchantStat[] {
  const byMerchant = new Map<string, MerchantStat>()
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.merchant.trim()) continue
    const existing = byMerchant.get(t.merchant)
    if (existing) {
      existing.transactionCount += 1
      existing.totalSpentCents += t.amountCents
    } else {
      byMerchant.set(t.merchant, {
        merchant: t.merchant,
        transactionCount: 1,
        totalSpentCents: t.amountCents,
      })
    }
  }
  return [...byMerchant.values()].sort((a, b) => b.totalSpentCents - a.totalSpentCents)
}

export interface AccountSpendingEntry {
  accountId: string
  name: string
  color: string
  amountCents: number
  percent: number
}

export function computeSpendingByAccount(
  transactions: Transaction[],
  accounts: Account[],
): AccountSpendingEntry[] {
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    totals.set(t.accountId, (totals.get(t.accountId) ?? 0) + t.amountCents)
  }
  const grandTotal = [...totals.values()].reduce((sum, v) => sum + v, 0)
  return [...totals.entries()]
    .map(([accountId, amountCents]) => ({
      accountId,
      name: accountById.get(accountId)?.name ?? 'Unknown',
      color: accountById.get(accountId)?.color ?? '#6b7280',
      amountCents,
      percent: percentOf(amountCents, grandTotal),
    }))
    .sort((a, b) => b.amountCents - a.amountCents)
}

/** Average total monthly expenses across every distinct calendar month present in the data. */
export function computeAverageMonthlySpending(transactions: Transaction[]): number {
  const byMonth = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    const key = t.date.slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) + t.amountCents)
  }
  if (byMonth.size === 0) return 0
  const total = [...byMonth.values()].reduce((sum, v) => sum + v, 0)
  return Math.round(total / byMonth.size)
}
