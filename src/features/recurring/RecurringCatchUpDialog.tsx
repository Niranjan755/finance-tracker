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
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/money'
import { formatDisplayDate } from '@/lib/date'
import type { DueRecurringEntry } from '@/lib/finance/recurringProjection'
import type { Account } from '@/types'

interface RecurringCatchUpDialogProps {
  open: boolean
  entries: DueRecurringEntry[]
  accounts: Account[]
  onRecordAll: () => void
  onReviewEach: () => void
  onCancel: () => void
}

export function RecurringCatchUpDialog({
  open,
  entries,
  accounts,
  onRecordAll,
  onReviewEach,
  onCancel,
}: RecurringCatchUpDialogProps) {
  const accountById = new Map(accounts.map((a) => [a.id, a]))

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Missed recurring transactions</AlertDialogTitle>
          <AlertDialogDescription>
            These recurring items have more than one occurrence overdue. If any amount changed
            since they were due, recording them all now will use today's amount for every one of
            them - review before continuing if that matters.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {entries.map(({ recurring, occurrences }) => {
            const account = accountById.get(recurring.accountId)
            const first = occurrences[0]
            const last = occurrences[occurrences.length - 1]
            return (
              <div key={recurring.id} className="rounded-lg border px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{recurring.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {occurrences.length} missed
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {first && formatDisplayDate(first.date)}
                  {last && last !== first ? ` – ${formatDisplayDate(last.date)}` : ''} ·{' '}
                  {formatCurrency(recurring.amountCents, account?.currency)} each
                </p>
              </div>
            )
          })}
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={onReviewEach}>
            Review Each
          </Button>
          <AlertDialogAction onClick={onRecordAll}>Record All</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
