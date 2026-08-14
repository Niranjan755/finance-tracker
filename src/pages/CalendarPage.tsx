import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { PageHeader } from '@/components/finance/PageHeader'
import { EmptyState } from '@/components/finance/EmptyState'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TransactionRow } from '@/features/transactions/TransactionRow'
import { useFinanceStore } from '@/store/financeStore'
import { getMonthBounds, toISODate } from '@/lib/date'
import { formatCurrency } from '@/lib/money'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarPage() {
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const accounts = useFinanceStore((s) => s.accounts)
  const currency = useFinanceStore((s) => s.settings.currency)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const bounds = getMonthBounds(year, month)
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const byDate = useMemo(() => {
    const map = new Map<string, { incomeCents: number; expenseCents: number }>()
    for (const t of transactions) {
      if (t.date < bounds.startISO || t.date > bounds.endISO) continue
      const entry = map.get(t.date) ?? { incomeCents: 0, expenseCents: 0 }
      if (t.type === 'income') entry.incomeCents += t.amountCents
      else entry.expenseCents += t.amountCents
      map.set(t.date, entry)
    }
    return map
  }, [transactions, bounds])

  const firstOfMonth = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const leadingBlanks = firstOfMonth.getDay()
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const selectedDayTransactions = selectedDate
    ? transactions
        .filter((t) => t.date === selectedDate)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  const hasAnyTransactions = transactions.length > 0

  return (
    <div>
      <PageHeader title="Calendar" description="See your income and expenses by day." />

      <div className="mb-4 flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium">{bounds.label}</span>
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {!hasAnyTransactions ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Your daily activity will show up here once you add transactions."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <div className="bg-muted/40 text-muted-foreground grid min-w-[560px] grid-cols-7 border-b text-center text-xs font-medium">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid min-w-[560px] grid-cols-7">
            {cells.map((day, i) => {
              if (day === null)
                return <div key={`blank-${i}`} className="bg-muted/10 min-h-24 border-r border-b" />
              const dateISO = toISODate(new Date(year, month - 1, day))
              const totals = byDate.get(dateISO)
              const isToday = dateISO === toISODate(new Date())
              return (
                <button
                  key={dateISO}
                  onClick={() => totals && setSelectedDate(dateISO)}
                  disabled={!totals}
                  className={cn(
                    'min-h-24 border-r border-b p-1.5 text-left align-top transition-colors',
                    totals ? 'hover:bg-accent' : 'cursor-default',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs',
                      isToday && 'bg-primary text-primary-foreground',
                    )}
                  >
                    {day}
                  </span>
                  {totals && (
                    <div className="mt-1 space-y-0.5 text-[11px] leading-tight">
                      {totals.incomeCents > 0 && (
                        <p className="text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(totals.incomeCents, currency)}
                        </p>
                      )}
                      {totals.expenseCents > 0 && (
                        <p className="text-red-600 dark:text-red-400">
                          -{formatCurrency(totals.expenseCents, currency)}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Sheet open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedDate}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            {selectedDayTransactions.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                category={categoryById.get(t.categoryId)}
                account={accountById.get(t.accountId)}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
