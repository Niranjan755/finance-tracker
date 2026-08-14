import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react'
import { PageHeader } from '@/components/finance/PageHeader'
import { EmptyState } from '@/components/finance/EmptyState'
import { MoneyText } from '@/components/finance/MoneyText'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TransactionRow } from '@/features/transactions/TransactionRow'
import { useFinanceStore } from '@/store/financeStore'
import { computeCategoryBreakdown, computeMonthlyStatement } from '@/lib/finance/calculations'
import { getMonthBounds, parseISODate } from '@/lib/date'
import { formatCurrency } from '@/lib/money'
import { exportTransactionsToCSV } from '@/lib/export/csv'
import { exportTransactionsToExcel } from '@/lib/export/excel'
import { downloadMonthlyStatementPDF } from '@/lib/export/pdf'
import { cn } from '@/lib/utils'
import type { Currency } from '@/types'

interface MonthOption {
  year: number
  month: number
  key: string
  label: string
}

export function ReportsPage() {
  const accounts = useFinanceStore((s) => s.accounts)
  const transactions = useFinanceStore((s) => s.transactions)
  const transfers = useFinanceStore((s) => s.transfers)
  const categories = useFinanceStore((s) => s.categories)
  const currency = useFinanceStore((s) => s.settings.currency)
  const userName = useFinanceStore((s) => s.settings.userName)

  const monthOptions = useMemo<MonthOption[]>(() => {
    const now = new Date()
    let earliest = now
    for (const t of transactions) {
      const d = parseISODate(t.date)
      if (d < earliest) earliest = d
    }
    for (const t of transfers) {
      const d = parseISODate(t.date)
      if (d < earliest) earliest = d
    }
    for (const a of accounts) {
      const d = new Date(a.createdAt)
      if (d < earliest) earliest = d
    }

    const options: MonthOption[] = []
    const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
    const stop = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
    while (cursor >= stop) {
      const bounds = getMonthBounds(cursor.getFullYear(), cursor.getMonth() + 1)
      options.push({
        year: bounds.year,
        month: bounds.month,
        key: `${bounds.year}-${bounds.month}`,
        label: bounds.label,
      })
      cursor.setMonth(cursor.getMonth() - 1)
    }
    return options
  }, [transactions, transfers, accounts])

  const [selectedKey, setSelectedKey] = useState(monthOptions[0]?.key)
  const selected = monthOptions.find((m) => m.key === selectedKey) ?? monthOptions[0]

  const bounds = selected ? getMonthBounds(selected.year, selected.month) : null
  const statement = useMemo(
    () => (bounds ? computeMonthlyStatement(accounts, transactions, transfers, bounds) : null),
    [accounts, transactions, transfers, bounds],
  )
  const incomeBreakdown = useMemo(
    () =>
      statement ? computeCategoryBreakdown(statement.incomeTransactions, categories, 'income') : [],
    [statement, categories],
  )
  const expenseBreakdown = useMemo(
    () =>
      statement
        ? computeCategoryBreakdown(statement.expenseTransactions, categories, 'expense')
        : [],
    [statement, categories],
  )
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const monthTransactions = useMemo(
    () =>
      statement
        ? [...statement.incomeTransactions, ...statement.expenseTransactions].sort((a, b) =>
            b.date.localeCompare(a.date),
          )
        : [],
    [statement],
  )
  const monthTransfers = useMemo(
    () =>
      bounds ? transfers.filter((t) => t.date >= bounds.startISO && t.date <= bounds.endISO) : [],
    [transfers, bounds],
  )

  if (monthOptions.length === 0 || !statement || !bounds) {
    return (
      <div>
        <PageHeader title="Reports" description="Monthly financial statements." />
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="Add some transactions to generate your first monthly statement."
        />
      </div>
    )
  }

  function handleExportCSV() {
    exportTransactionsToCSV(
      monthTransactions,
      monthTransfers,
      accounts,
      categories,
      `finance-statement-${selected!.key}.csv`,
    )
    toast.success('CSV exported')
  }

  async function handleExportExcel() {
    try {
      await exportTransactionsToExcel(
        monthTransactions,
        monthTransfers,
        accounts,
        categories,
        `finance-statement-${selected!.key}.xlsx`,
      )
      toast.success('Excel file exported')
    } catch {
      toast.error('Unable to export Excel file')
    }
  }

  function handleExportPDF() {
    if (!statement) return
    downloadMonthlyStatementPDF(
      { userName, statement, incomeBreakdown, expenseBreakdown, accounts, categories, currency },
      `finance-statement-${selected!.key}.pdf`,
    )
    toast.success('PDF exported')
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Monthly financial statements you can export."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <FileDown className="size-4" aria-hidden="true" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              Excel
            </Button>
            <Button size="sm" onClick={handleExportPDF} className="gap-1.5">
              <FileText className="size-4" aria-hidden="true" />
              PDF
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]">
        <ScrollArea className="h-fit max-h-[70vh] rounded-lg border">
          <div className="flex flex-col p-1">
            {monthOptions.map((m) => (
              <button
                key={m.key}
                onClick={() => setSelectedKey(m.key)}
                className={cn(
                  'rounded-md px-3 py-2 text-left text-sm',
                  m.key === selected?.key
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-6 text-center">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Financial Statement
              </p>
              <h2 className="text-2xl font-bold">{bounds.label.toUpperCase()}</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-4">
              <Stat
                label="Opening Balance"
                cents={statement.openingBalanceCents}
                currency={currency}
              />
              <Stat
                label="Closing Balance"
                cents={statement.closingBalanceCents}
                currency={currency}
              />
              <Stat
                label="Net Cash Flow"
                cents={statement.netCashFlowCents}
                currency={currency}
                colored
              />
              <Stat label="Savings Rate" text={`${statement.savingsRatePercent.toFixed(1)}%`} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Income</h3>
                <dl className="space-y-1.5 text-sm">
                  {incomeBreakdown.map((e) => (
                    <div key={e.categoryId} className="flex justify-between">
                      <dt className="text-muted-foreground">{e.name}</dt>
                      <dd className="text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(e.amountCents, currency)}
                      </dd>
                    </div>
                  ))}
                  {incomeBreakdown.length === 0 && (
                    <p className="text-muted-foreground">No income this month.</p>
                  )}
                </dl>
                <div className="mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>Total Income</span>
                  <MoneyText
                    cents={statement.totalIncomeCents}
                    kind="income"
                    signed={false}
                    currency={currency}
                  />
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Expenses</h3>
                <dl className="space-y-1.5 text-sm">
                  {expenseBreakdown.map((e) => (
                    <div key={e.categoryId} className="flex justify-between">
                      <dt className="text-muted-foreground">{e.name}</dt>
                      <dd className="text-red-600 dark:text-red-400">
                        -{formatCurrency(e.amountCents, currency)}
                      </dd>
                    </div>
                  ))}
                  {expenseBreakdown.length === 0 && (
                    <p className="text-muted-foreground">No expenses this month.</p>
                  )}
                </dl>
                <div className="mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>Total Expenses</span>
                  <MoneyText
                    cents={statement.totalExpenseCents}
                    kind="expense"
                    signed={false}
                    currency={currency}
                  />
                </div>
              </div>
            </div>

            {statement.largestExpense && (
              <p className="text-muted-foreground mt-6 border-t pt-4 text-sm">
                Largest expense:{' '}
                <span className="text-foreground font-medium">
                  {statement.largestExpense.merchant || 'Transaction'}
                </span>{' '}
                - {formatCurrency(statement.largestExpense.amountCents, currency)}
              </p>
            )}
            <p className="text-muted-foreground text-sm">
              {statement.transactionCount} transactions this month.
            </p>
          </Card>

          <div>
            <h3 className="text-muted-foreground mb-3 text-sm font-medium">Transactions</h3>
            {monthTransactions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No transactions"
                description="No transactions were recorded in this month."
              />
            ) : (
              <Card className="divide-y p-1">
                {monthTransactions.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    category={categoryById.get(t.categoryId)}
                    account={accountById.get(t.accountId)}
                  />
                ))}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  cents,
  currency,
  text,
  colored,
}: {
  label: string
  cents?: number
  currency?: Currency
  text?: string
  colored?: boolean
}) {
  return (
    <div className="text-center">
      <p className="text-muted-foreground text-xs">{label}</p>
      {text ? (
        <p className="mt-1 font-semibold">{text}</p>
      ) : (
        <MoneyText
          cents={cents ?? 0}
          kind={colored ? ((cents ?? 0) >= 0 ? 'income' : 'expense') : 'neutral'}
          signed={colored}
          currency={currency}
          className="mt-1 block font-semibold"
        />
      )}
    </div>
  )
}
