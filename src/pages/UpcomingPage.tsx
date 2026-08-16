import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, MoreVertical, Pause, Play, Plus } from 'lucide-react'
import { PageHeader } from '@/components/finance/PageHeader'
import { EmptyState } from '@/components/finance/EmptyState'
import { MoneyText } from '@/components/finance/MoneyText'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RecurringForm } from '@/features/recurring/RecurringForm'
import { useFinanceStore } from '@/store/financeStore'
import { computeAccountTotals } from '@/lib/finance/calculations'
import { projectAllOccurrences } from '@/lib/finance/recurringProjection'
import { getIcon } from '@/lib/icons'
import { formatDisplayDate, todayISODate } from '@/lib/date'
import { FREQUENCY_LABELS } from '@/lib/validation/recurring'
import type { RecurringInput } from '@/lib/finance/recurringOps'
import type { RecurringTransaction } from '@/types'

const HORIZON_DAYS = 60

export function UpcomingPage() {
  const accounts = useFinanceStore((s) => s.accounts)
  const categories = useFinanceStore((s) => s.categories)
  const currency = useFinanceStore((s) => s.settings.currency)
  const recurring = useFinanceStore((s) => s.recurring)
  const addRecurring = useFinanceStore((s) => s.addRecurring)
  const editRecurring = useFinanceStore((s) => s.editRecurring)
  const removeRecurring = useFinanceStore((s) => s.removeRecurring)
  const postRecurringNow = useFinanceStore((s) => s.postRecurringNow)

  const [formOpen, setFormOpen] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | undefined>(
    undefined,
  )
  const [deletingRecurring, setDeletingRecurring] = useState<RecurringTransaction | null>(null)

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const today = todayISODate()
  const occurrences = useMemo(
    () => projectAllOccurrences(recurring, today, HORIZON_DAYS),
    [recurring, today],
  )
  const firstOccurrenceIds = useMemo(() => {
    const seen = new Set<string>()
    return new Set(
      occurrences
        .filter((o) => (seen.has(o.recurringId) ? false : (seen.add(o.recurringId), true)))
        .map((o) => o.recurringId),
    )
  }, [occurrences])

  const expectedExpenseCents = occurrences
    .filter((o) => o.type === 'expense')
    .reduce((s, o) => s + o.amountCents, 0)
  const expectedIncomeCents = occurrences
    .filter((o) => o.type === 'income')
    .reduce((s, o) => s + o.amountCents, 0)
  const totals = computeAccountTotals(accounts, currency)
  const expectedRemainingCents =
    totals.availableCashCents + expectedIncomeCents - expectedExpenseCents

  function openAdd() {
    setEditingRecurring(undefined)
    setFormOpen(true)
  }

  function openEdit(item: RecurringTransaction) {
    setEditingRecurring(item)
    setFormOpen(true)
  }

  async function handleSubmit(values: RecurringInput) {
    try {
      if (editingRecurring) {
        await editRecurring(editingRecurring.id, values)
        toast.success('Recurring transaction updated')
      } else {
        await addRecurring(values)
        toast.success('Recurring transaction added')
      }
      setFormOpen(false)
    } catch (err) {
      toast.error('Unable to save', { description: err instanceof Error ? err.message : undefined })
    }
  }

  async function handleDelete() {
    if (!deletingRecurring) return
    await removeRecurring(deletingRecurring.id)
    toast.success('Recurring transaction deleted')
    setDeletingRecurring(null)
  }

  async function handleRecordNow(id: string, date: string) {
    try {
      await postRecurringNow(id, date)
      toast.success('Transaction recorded')
    } catch (err) {
      toast.error('Unable to record transaction', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div>
      <PageHeader
        title="Upcoming"
        description={`Projected activity over the next ${HORIZON_DAYS} days.`}
        actions={
          <Button onClick={openAdd} className="gap-1.5">
            <Plus className="size-4" aria-hidden="true" />
            Add Recurring
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-muted-foreground text-xs font-medium">Expected Upcoming Expenses</p>
          <MoneyText
            cents={expectedExpenseCents}
            kind="expense"
            signed={false}
            className="mt-1 block text-2xl font-semibold"
          />
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs font-medium">Expected Remaining Balance</p>
          <MoneyText
            cents={expectedRemainingCents}
            kind="neutral"
            signed={false}
            className="mt-1 block text-2xl font-semibold"
          />
        </Card>
      </div>

      <h3 className="text-muted-foreground mb-3 text-sm font-medium">Upcoming Payments</h3>
      {occurrences.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing upcoming"
          description="Add a recurring transaction like rent or a subscription to see it projected here."
          className="mb-8"
        />
      ) : (
        <Card className="mb-8 divide-y p-1">
          {occurrences.map((o, i) => {
            const category = categoryById.get(o.categoryId)
            const account = accountById.get(o.accountId)
            const Icon = getIcon(category?.icon ?? 'circle-dashed')
            const canRecordNow =
              o.date <= today &&
              firstOccurrenceIds.has(o.recurringId) &&
              occurrences.findIndex((x) => x.recurringId === o.recurringId) === i
            return (
              <div
                key={`${o.recurringId}-${o.date}`}
                className="flex items-center gap-3 px-2 py-2.5"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `${category?.color ?? '#6b7280'}1a`,
                    color: category?.color ?? '#6b7280',
                  }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {account?.name} · {formatDisplayDate(o.date)}
                    {o.date < today && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">Overdue</span>
                    )}
                  </p>
                </div>
                <MoneyText
                  cents={o.amountCents}
                  kind={o.type}
                  currency={account?.currency}
                  className="shrink-0 text-sm font-medium"
                />
                {canRecordNow && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRecordNow(o.recurringId, o.date)}
                  >
                    Record Now
                  </Button>
                )}
              </div>
            )
          })}
        </Card>
      )}

      <h3 className="text-muted-foreground mb-3 text-sm font-medium">Recurring Transactions</h3>
      {recurring.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No recurring transactions"
          description="Set up rent, subscriptions, or your paycheck to project them automatically."
          action={
            <Button onClick={openAdd} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              Add Recurring
            </Button>
          }
        />
      ) : (
        <Card className="divide-y p-1">
          {recurring.map((item) => {
            const category = categoryById.get(item.categoryId)
            const account = accountById.get(item.accountId)
            const Icon = getIcon(category?.icon ?? 'circle-dashed')
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-2 py-2.5 ${!item.isActive ? 'opacity-50' : ''}`}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `${category?.color ?? '#6b7280'}1a`,
                    color: category?.color ?? '#6b7280',
                  }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {account?.name} · {FREQUENCY_LABELS[item.frequency]}
                    {!item.isActive && ' · Paused'}
                  </p>
                </div>
                <Badge variant="outline" className="hidden sm:inline-flex">
                  Next {formatDisplayDate(item.nextRunDate)}
                </Badge>
                <MoneyText
                  cents={item.amountCents}
                  kind={item.type}
                  currency={account?.currency}
                  className="shrink-0 text-sm font-medium"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Actions for ${item.name}`}
                      >
                        <MoreVertical className="size-4" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(item)}>Edit</DropdownMenuItem>
                    {item.isActive ? (
                      <DropdownMenuItem onClick={() => editRecurring(item.id, { isActive: false })}>
                        <Pause className="size-4" aria-hidden="true" />
                        Pause
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => editRecurring(item.id, { isActive: true })}>
                        <Play className="size-4" aria-hidden="true" />
                        Resume
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeletingRecurring(item)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecurring ? 'Edit Recurring Transaction' : 'Add Recurring Transaction'}
            </DialogTitle>
          </DialogHeader>
          <RecurringForm
            accounts={accounts}
            categories={categories}
            recurring={editingRecurring}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingRecurring}
        onOpenChange={(open) => !open && setDeletingRecurring(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingRecurring?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the recurring schedule. Transactions already recorded from it are not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
