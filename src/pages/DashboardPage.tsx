import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LandmarkIcon, Receipt, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/finance/EmptyState'
import { MoneyText } from '@/components/finance/MoneyText'
import { PageHeader } from '@/components/finance/PageHeader'
import { TransactionRow } from '@/features/transactions/TransactionRow'
import { AddTransactionMenu } from '@/components/finance/AddTransactionMenu'
import { useFinanceStore } from '@/store/financeStore'
import { computeAccountTotals, computeMonthlyStatement } from '@/lib/finance/calculations'
import { getMonthBounds } from '@/lib/date'
import { getIcon } from '@/lib/icons'
import { formatCurrency } from '@/lib/money'

export function DashboardPage() {
  const navigate = useNavigate()
  const { accounts, transactions, transfers, categories } = useFinanceStore((s) => ({
    accounts: s.accounts,
    transactions: s.transactions,
    transfers: s.transfers,
    categories: s.categories,
  }))

  const totals = computeAccountTotals(accounts)
  const bounds = useMemo(() => {
    const now = new Date()
    return getMonthBounds(now.getFullYear(), now.getMonth() + 1)
  }, [])
  const statement = computeMonthlyStatement(accounts, transactions, transfers, bounds)
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

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
        <PageHeader title="Dashboard" description="Your complete financial picture, updated in real time." />
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
        <StatCard label="Net Worth" cents={totals.netWorthCents} />
        <StatCard label="Available Cash" cents={totals.availableCashCents} />
        <StatCard label="Credit Card Debt" cents={totals.creditCardDebtCents} kind="expense" />
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Savings Rate</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{statement.savingsRatePercent.toFixed(1)}%</p>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">This Month's Income</p>
          <MoneyText cents={statement.totalIncomeCents} kind="income" signed={false} className="mt-1 block text-xl font-semibold" />
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">This Month's Expenses</p>
          <MoneyText cents={statement.totalExpenseCents} kind="expense" signed={false} className="mt-1 block text-xl font-semibold" />
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Remaining This Month</p>
          <MoneyText cents={statement.netCashFlowCents} kind={statement.netCashFlowCents >= 0 ? 'income' : 'expense'} signed className="mt-1 block text-xl font-semibold" />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Recent Transactions</h3>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/transactions')}>
              View all
            </Button>
          </div>
          {recentTransactions.length === 0 ? (
            <EmptyState icon={Receipt} title="No transactions yet" description="Add your first expense or income to see it here." />
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
            <h3 className="text-sm font-medium text-muted-foreground">Accounts</h3>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/accounts')}>
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
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-accent"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: account.color }}>
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{account.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {account.lastFour ? `••••${account.lastFour}` : account.institution}
                    </p>
                  </div>
                  <span className={`text-sm font-medium tabular-nums ${isLiability ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {isLiability ? '-' : ''}
                    {formatCurrency(account.balanceCents, account.currency)}
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

function StatCard({ label, cents, kind = 'neutral' }: { label: string; cents: number; kind?: 'income' | 'expense' | 'neutral' }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <MoneyText cents={cents} kind={kind} signed={false} className="mt-1 block text-2xl font-semibold" />
    </Card>
  )
}
