import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lightbulb, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/finance/PageHeader'
import { EmptyState } from '@/components/finance/EmptyState'
import { MoneyText } from '@/components/finance/MoneyText'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { IncomeExpenseChart } from '@/features/dashboard/IncomeExpenseChart'
import { NetWorthTrendChart } from '@/features/dashboard/NetWorthTrendChart'
import { useFinanceStore } from '@/store/financeStore'
import {
  computeAverageMonthlySpending,
  computeCategoryBreakdown,
  computeMerchantStats,
  computeSpendingByAccount,
} from '@/lib/finance/calculations'
import { computeIncomeVsExpenseSeries, computeNetWorthTrend } from '@/lib/finance/timeSeries'
import { computeInsights } from '@/lib/finance/insights'
import { formatCurrency } from '@/lib/money'
import { todayISODate } from '@/lib/date'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const accounts = useFinanceStore((s) => s.accounts)
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const currency = useFinanceStore((s) => s.settings.currency)

  const today = todayISODate()

  const insights = useMemo(
    () => computeInsights(accounts, transactions, categories, currency, today),
    [accounts, transactions, categories, currency, today],
  )
  const expenseByCategory = useMemo(() => computeCategoryBreakdown(transactions, categories, 'expense'), [transactions, categories])
  const incomeBySource = useMemo(() => computeCategoryBreakdown(transactions, categories, 'income'), [transactions, categories])
  const byAccount = useMemo(() => computeSpendingByAccount(transactions, accounts), [transactions, accounts])
  const merchants = useMemo(() => computeMerchantStats(transactions).slice(0, 8), [transactions])
  const avgMonthlySpending = useMemo(() => computeAverageMonthlySpending(transactions), [transactions])
  const incomeExpenseSeries = useMemo(() => computeIncomeVsExpenseSeries(transactions, today, 6), [transactions, today])
  const netWorthTrend = useMemo(() => computeNetWorthTrend(accounts, transactions, today, 6), [accounts, transactions, today])

  const totalDays = new Set(transactions.filter((t) => t.type === 'expense').map((t) => t.date)).size
  const totalExpenseCents = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0)
  const avgDailySpending = totalDays > 0 ? Math.round(totalExpenseCents / totalDays) : 0
  const largestExpense = transactions.filter((t) => t.type === 'expense').sort((a, b) => b.amountCents - a.amountCents)[0]
  const topMerchant = merchants[0]

  if (transactions.length === 0) {
    return (
      <div>
        <PageHeader title="Analytics" description="Deeper insight into your spending and income." />
        <EmptyState icon={TrendingUp} title="Not enough data yet" description="Add some transactions to see analytics here." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Analytics" description="Deeper insight into your spending and income." />

      {insights.length > 0 && (
        <Card className="mb-6 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" aria-hidden="true" />
            <h3 className="text-sm font-semibold">Insights</h3>
          </div>
          <ul className="space-y-2 text-sm">
            {insights.map((insight) => (
              <li key={insight.id} className="text-muted-foreground">
                {insight.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Avg Daily Spending</p>
          <MoneyText cents={avgDailySpending} kind="expense" signed={false} className="mt-1 block text-xl font-semibold" />
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Avg Monthly Spending</p>
          <MoneyText cents={avgMonthlySpending} kind="expense" signed={false} className="mt-1 block text-xl font-semibold" />
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Largest Expense</p>
          {largestExpense ? (
            <>
              <MoneyText cents={largestExpense.amountCents} kind="expense" signed={false} className="mt-1 block text-xl font-semibold" />
              <p className="truncate text-xs text-muted-foreground">{largestExpense.merchant || 'Transaction'}</p>
            </>
          ) : (
            <p className="mt-1 text-xl font-semibold">-</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Most Frequent Merchant</p>
          {topMerchant ? (
            <>
              <p className="mt-1 truncate text-xl font-semibold">{topMerchant.merchant}</p>
              <p className="text-xs text-muted-foreground">{topMerchant.transactionCount} transactions</p>
            </>
          ) : (
            <p className="mt-1 text-xl font-semibold">-</p>
          )}
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Monthly Income vs Expenses</p>
          <IncomeExpenseChart data={incomeExpenseSeries} />
        </Card>
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Net Worth</p>
          <NetWorthTrendChart data={netWorthTrend} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Spending by Category</h3>
          <Card className="space-y-3 p-4">
            {expenseByCategory.slice(0, 8).map((e) => (
              <button
                key={e.categoryId}
                onClick={() => navigate(`/transactions?category=${e.categoryId}`)}
                className="block w-full text-left"
              >
                <div className="mb-1 flex justify-between text-sm">
                  <span>{e.name}</span>
                  <span className="text-muted-foreground">{formatCurrency(e.amountCents, currency)}</span>
                </div>
                <Progress value={e.percent} className="h-1.5" />
              </button>
            ))}
            {expenseByCategory.length === 0 && <p className="text-sm text-muted-foreground">No expenses yet.</p>}
          </Card>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Spending by Account</h3>
          <Card className="space-y-3 p-4">
            {byAccount.map((a) => (
              <div key={a.accountId}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{a.name}</span>
                  <span className="text-muted-foreground">{formatCurrency(a.amountCents, currency)}</span>
                </div>
                <Progress value={a.percent} className="h-1.5" />
              </div>
            ))}
            {byAccount.length === 0 && <p className="text-sm text-muted-foreground">No expenses yet.</p>}
          </Card>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Income by Source</h3>
          <Card className="space-y-3 p-4">
            {incomeBySource.map((e) => (
              <div key={e.categoryId} className="flex justify-between text-sm">
                <span>{e.name}</span>
                <MoneyText cents={e.amountCents} kind="income" signed={false} currency={currency} />
              </div>
            ))}
            {incomeBySource.length === 0 && <p className="text-sm text-muted-foreground">No income yet.</p>}
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Top Merchants</h3>
        <Card className="divide-y p-1">
          {merchants.map((m) => (
            <div key={m.merchant} className="flex items-center justify-between px-3 py-2.5 text-sm">
              <div>
                <p className="font-medium">{m.merchant}</p>
                <p className="text-xs text-muted-foreground">{m.transactionCount} transactions</p>
              </div>
              <MoneyText cents={m.totalSpentCents} kind="expense" signed={false} currency={currency} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
