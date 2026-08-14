import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, Pencil, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
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
import { getIcon } from '@/lib/icons'
import { formatDisplayDate } from '@/lib/date'
import { formatCurrency } from '@/lib/money'
import { useFinanceStore } from '@/store/financeStore'
import { useUIStore } from '@/store/uiStore'
import type { Transfer } from '@/types'

interface TransferDetailSheetProps {
  transfer: Transfer | null
  onClose: () => void
}

export function TransferDetailSheet({ transfer, onClose }: TransferDetailSheetProps) {
  const accounts = useFinanceStore((s) => s.accounts)
  const removeTransfer = useFinanceStore((s) => s.removeTransfer)
  const openEditTransfer = useUIStore((s) => s.openEditTransfer)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!transfer) return null

  const fromAccount = accounts.find((a) => a.id === transfer.fromAccountId)
  const toAccount = accounts.find((a) => a.id === transfer.toAccountId)
  const FromIcon = fromAccount ? getIcon(fromAccount.icon) : null
  const ToIcon = toAccount ? getIcon(toAccount.icon) : null

  async function handleDelete() {
    if (!transfer) return
    await removeTransfer(transfer.id)
    toast.success('Transfer deleted')
    setDeleteOpen(false)
    onClose()
  }

  return (
    <>
      <Sheet open={!!transfer} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {transfer.isCreditCardPayment ? 'Credit Card Payment' : 'Transfer'}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-6">
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {FromIcon && <FromIcon className="size-4" aria-hidden="true" />}
                  <span className="text-sm font-medium">
                    {fromAccount?.name ?? 'Unknown account'}
                  </span>
                </div>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  -{formatCurrency(transfer.fromAmountCents, fromAccount?.currency)}
                </span>
              </div>
              <div className="text-muted-foreground flex justify-center">
                <ArrowDown className="size-4" aria-hidden="true" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {ToIcon && <ToIcon className="size-4" aria-hidden="true" />}
                  <span className="text-sm font-medium">
                    {toAccount?.name ?? 'Unknown account'}
                  </span>
                </div>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(transfer.toAmountCents, toAccount?.currency)}
                </span>
              </div>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{formatDisplayDate(transfer.date)}</dd>
              </div>
              {transfer.description && (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd className="text-right">{transfer.description}</dd>
                </div>
              )}
              {transfer.exchangeRate !== 1 && (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted-foreground">Exchange Rate</dt>
                  <dd className="text-right">
                    1 {fromAccount?.currency} = {transfer.exchangeRate.toFixed(4)} {toAccount?.currency}
                  </dd>
                </div>
              )}
            </dl>

            <p className="bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-xs">
              Transfers move money between your own accounts and never count as income or spending.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="flex-col gap-1 py-4"
                onClick={() => openEditTransfer(transfer.id)}
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="text-destructive flex-col gap-1 py-4"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transfer?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Both account balances will be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
