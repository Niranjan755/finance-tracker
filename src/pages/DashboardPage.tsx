import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LandmarkIcon, Receipt, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/finance/EmptyState'
import { MoneyText } from '@/components/finance/MoneyText'
import { PageHeader } from '@/components/finance/PageHeader'
import { TransactionRow } from '@/features/transactions/TransactionRow'
import { AddTransactionMenu } from '@/components/finance/AddTransactionMenu'
import { DateRangeSelector } from '@/features/dashboard/DateRangeSelector'
import { IncomeExpenseChart } from '@/features/dashboard/IncomeExpenseChart'
import { ExpenseBreakdownChart } from '@/features/dashboard/ExpenseBreakdownChart'
import { SpendingTrendChart } from '@/features/dashboard/SpendingTrendChart'
import { NetWorthTrendChart } from '@/features/dashboard/NetWorthTrendChart'
import { AccountBalanceChart } from '@/features/dashboard/AccountBalanceChart'
import { useFinanceStore } from '@/store/financeStore'
import {
  computeAccountTotals,
  computeCategoryBreakdown,
  computeMonthlyStatement,
} from '@/lib/finance/calculations'
import {
  computeAccountBalanceTrend,
  computeIncomeVsExpenseSeries,
  computeNetWorthTrend,
  computeSpendingTrend,
  rangeFromPreset,
  type DateRangePreset,
} from '@/lib/finance/timeSeries'
import { getMonthBounds, isDateInRange, todayISODate } from '@/lib/date'
import { getIcon } from '@/lib/icons'
import { formatCurrency } from '@/lib/money'
import type { Currency } from '@/types'

const MONTHS_FOR_PRESET: Record<DateRangePreset, number> = {
  '7d': 3,
  '30d': 3,
  '3m': 6,
  '6m': 6,
  '1y': 12,
  custom: 12,
}

export function DashboardPage() {
  const navigate = useNavigate()
  const accounts = useFinanceStore((s) => s.accounts)
  const transactions = useFinanceStore((s) => s.transactions)
  const transfers = useFinanceStore((s) => s.transfers)
  const categories = useFinanceStore((s) => s.categories)
  const [preset, setPreset] = useState<DateRangePreset>('30d')

  const totals = computeAccountTotals(accounts)
  const totalsByCurrency = Object.values(totals.byCurrency).filter((group) => group.totalAssetsCents > 0 || group.totalLiabilitiesCents > 0)
  const bounds = useMemo(() => {
    const now = new Date()
    return getMonthBounds(now.getFullYear(), now.getMonth() + 1)
  }, [])
  const statement = computeMonthlyStatement(accounts, transactions, transfers, bounds)
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const today = todayISODate()
  const range = useMemo(() => rangeFromPreset(preset, new Date()), [preset])
  const months = MONTHS_FOR_PRESET[preset]

  const incomeExpenseSeries = useMemo(
    () => computeIncomeVsExpenseSeries(transactions, today, months),
    [transactions, today, months],
  )
  const spendingTrend = useMemo(
    () => computeSpendingTrend(transactions, range),
    [transactions, range],
  )
  const netWorthTrend = useMemo(
    () => computeNetWorthTrend(accounts, transactions, today, months),
    [accounts, transactions, today, months],
  )
  const accountBalanceTrend = useMemo(
    () => computeAccountBalanceTrend(accounts, transactions, today, months),
    [accounts, transactions, today, months],
  )
  const expenseBreakdown = useMemo(() => {
    const inRange = transactions.filter((t) => isDateInRange(t.date, range.startISO, range.endISO))
    return computeCategoryBreakdown(inRange, categories, 'expense')
  }, [transactions, categories, range])

  const recentTransactions = useMemo(
    () =>
      transactions
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6),
    [transactions],
  )

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Your complete financial picture, updated in real time."
        />
        <EmptyState
          icon={Wallet}
          title="Welcome to Finance Tracker"
          description="Add your first account to start tracking your income, expenses, and net worth."
          action={
            <Button onClick={() => navigate('/accounts')} className="gap-1.5">
              <LandmarkIcon className="size-4" aria-hidden="true" />
              Add an Account
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={bounds.label}
        actions={<AddTransactionMenu className="hidden sm:inline-flex" />}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totalsByCurrency.length > 0 ? (
          totalsByCurrency.map((group) => (
            <StatCard
              key={group.currency}
              label={`${group.currency} Net Worth`}
              cents={group.netWorthCents}
              currency={group.currency}
            />
          ))
        ) : (
          <StatCard label="Net Worth" cents={totals.netWorthCents} />
        )}
        {totalsByCurrency.length > 0 ? (
          totalsByCurrency.map((group) => (
            <StatCard
              key={`${group.currency}-cash`}
              label={`${group.currency} Available Cash`}
              cents={group.availableCashCents}
              currency={group.currency}
            />
          ))
        ) : (
          <StatCard label="Available Cash" cents={totals.availableCashCents} />
        )}
        {totalsByCurrency.length > 0 ? (
          totalsByCurrency.map((group) => (
            <StatCard
              key={`${group.currency}-debt`}
              label={`${group.currency} Credit Card Debt`}
              cents={group.creditCardDebtCents}
              kind="expense"
              currency={group.currency}
            />
          ))
        ) : (
          <StatCard label="Credit Card Debt" cents={totals.creditCardDebtCents} kind="expense" />
        )}
        <Card className="p-4">
          <p className="text-muted-foreground text-xs font-medium">Savings Rate</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {statement.savingsRatePercent.toFixed(1)}%
          </p>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-muted-foreground text-xs font-medium">This Month's Income</p>
          <MoneyText
            cents={statement.totalIncomeCents}
            kind="income"
            signed={false}
            className="mt-1 block text-xl font-semibold"
          />
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs font-medium">This Month's Expenses</p>
          <MoneyText
            cents={statement.totalExpenseCents}
            kind="expense"
            signed={false}
            className="mt-1 block text-xl font-semibold"
          />
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs font-medium">Remaining This Month</p>
          <MoneyText
            cents={statement.netCashFlowCents}
            kind={statement.netCashFlowCents >= 0 ? 'income' : 'expense'}
            signed
            className="mt-1 block text-xl font-semibold"
          />
        </Card>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-muted-foreground text-sm font-medium">Charts</h3>
        <DateRangeSelector value={preset} onChange={setPreset} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Income vs Expenses</p>
          <IncomeExpenseChart data={incomeExpenseSeries} />
        </Card>
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Expense Breakdown</p>
          <ExpenseBreakdownChart data={expenseBreakdown} />
        </Card>
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Spending Trend</p>
          <SpendingTrendChart data={spendingTrend} />
        </Card>
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium">Net Worth Trend</p>
          <NetWorthTrendChart data={netWorthTrend} />
        </Card>
        <Card className="p-4 lg:col-span-2">
          <p className="mb-2 text-sm font-medium">Account Balances</p>
          <AccountBalanceChart data={accountBalanceTrend} accounts={accounts} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-muted-foreground text-sm font-medium">Recent Transactions</h3>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => navigate('/transactions')}
            >
              View all
            </Button>
          </div>
          {recentTransactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              description="Add your first expense or income to see it here."
            />
          ) : (
            <Card className="divide-y p-1">
              {recentTransactions.map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  category={categoryById.get(t.categoryId)}
                  account={accountById.get(t.accountId)}
                  onClick={() => navigate(`/transactions?highlight=${t.id}`)}
                />
              ))}
            </Card>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-muted-foreground text-sm font-medium">Accounts</h3>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => navigate('/accounts')}
            >
              View all
            </Button>
          </div>
          <Card className="divide-y p-1">
            {accounts.map((account) => {
              const Icon = getIcon(account.icon)
              const isLiability = account.type === 'credit_card'
              return (
                <button
                  key={account.id}
                  onClick={() => navigate(`/accounts/${account.id}`)}
                  className="hover:bg-accent flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left"
                >
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: account.color }}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{account.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {account.lastFour ? `••••${account.lastFour}` : account.institution}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-medium tabular-nums ${isLiability ? 'text-red-600 dark:text-red-400' : ''}`}
                  >
                    {formatCurrency(
                      isLiability ? -account.balanceCents : account.balanceCents,
                      account.currency,
                    )}
                  </span>
                </button>
              )
            })}
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  cents,
  kind = 'neutral',
  currency = 'USD',
}: {
  label: string
  cents: number
  kind?: 'income' | 'expense' | 'neutral'
  currency?: Currency
}) {
  return (
    <Card className="p-4">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <MoneyText
        cents={cents}
        kind={kind}
        signed={false}
        currency={currency}
        className="mt-1 block text-2xl font-semibold"
      />
    </Card>
  )
}
