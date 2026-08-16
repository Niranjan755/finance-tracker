import { toast } from 'sonner'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { useState } from 'react'
import { getIcon } from '@/lib/icons'
import { formatDisplayDate } from '@/lib/date'
import { MoneyText } from '@/components/finance/MoneyText'
import { useFinanceStore } from '@/store/financeStore'
import { useUIStore } from '@/store/uiStore'
import { ReceiptSection } from './ReceiptSection'
import type { Transaction } from '@/types'

interface TransactionDetailSheetProps {
  transaction: Transaction | null
  onClose: () => void
}

export function TransactionDetailSheet({ transaction, onClose }: TransactionDetailSheetProps) {
  const accounts = useFinanceStore((s) => s.accounts)
  const categories = useFinanceStore((s) => s.categories)
  const transactions = useFinanceStore((s) => s.transactions)
  const removeTransaction = useFinanceStore((s) => s.removeTransaction)
  const restoreTransaction = useFinanceStore((s) => s.restoreTransaction)
  const dismissDuplicateFlag = useFinanceStore((s) => s.dismissDuplicateFlag)
  const duplicateTransaction = useFinanceStore((s) => s.duplicateTransaction)
  const openEditTransaction = useUIStore((s) => s.openEditTransaction)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!transaction) return null

  const account = accounts.find((a) => a.id === transaction.accountId)
  const category = categories.find((c) => c.id === transaction.categoryId)
  const parentCategory = category?.parentId
    ? categories.find((c) => c.id === category.parentId)
    : undefined
  const Icon = getIcon(category?.icon ?? 'circle-dashed')
  const duplicateOf = transaction.possibleDuplicateOfId
    ? transactions.find((t) => t.id === transaction.possibleDuplicateOfId)
    : undefined

  async function handleKeepBoth() {
    if (!transaction) return
    await dismissDuplicateFlag(transaction.id)
    toast.success('Kept both transactions')
  }

  async function handleRemoveManualDuplicate() {
    if (!transaction || !duplicateOf) return
    const deleted = await removeTransaction(duplicateOf.id)
    await dismissDuplicateFlag(transaction.id)
    toast.success('Manual entry removed', {
      duration: 8000,
      action: deleted
        ? {
            label: 'Undo',
            onClick: () => restoreTransaction(deleted.transaction, deleted.receipt),
          }
        : undefined,
    })
  }

  async function handleDelete() {
    if (!transaction) return
    const deleted = await removeTransaction(transaction.id)
    toast.success('Transaction deleted', {
      duration: 8000,
      action: deleted
        ? {
            label: 'Undo',
            onClick: () => restoreTransaction(deleted.transaction, deleted.receipt),
          }
        : undefined,
    })
    setDeleteOpen(false)
    onClose()
  }

  async function handleDuplicate() {
    if (!transaction) return
    await duplicateTransaction(transaction.id)
    toast.success('Transaction duplicated')
    onClose()
  }

  return (
    <>
      <Sheet open={!!transaction} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="sr-only">Transaction Details</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-6">
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <div
                className="flex size-12 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${category?.color ?? '#6b7280'}1a`,
                  color: category?.color ?? '#6b7280',
                }}
              >
                <Icon className="size-6" aria-hidden="true" />
              </div>
              <p className="text-lg font-medium">
                {transaction.merchant || category?.name || 'Transaction'}
              </p>
              <MoneyText
                cents={transaction.amountCents}
                kind={transaction.type}
                currency={account?.currency}
                className="text-3xl font-semibold"
              />
              {transaction.plaidTransactionId && <Badge variant="secondary">Synced via Plaid</Badge>}
            </div>

            {duplicateOf && (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs">
                <p className="font-medium text-amber-700 dark:text-amber-400">Possible duplicate</p>
                <p className="text-muted-foreground">
                  This looks like the same purchase as a transaction you already logged by hand on{' '}
                  {formatDisplayDate(duplicateOf.date)}
                  {duplicateOf.merchant ? ` at ${duplicateOf.merchant}` : ''}.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={handleKeepBoth}>
                    Keep both
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleRemoveManualDuplicate}>
                    Remove manual entry
                  </Button>
                </div>
              </div>
            )}

            <dl className="space-y-3 text-sm">
              <Row
                label="Category"
                value={
                  parentCategory
                    ? `${parentCategory.name} → ${category?.name}`
                    : (category?.name ?? '-')
                }
              />
              <Row
                label={transaction.type === 'expense' ? 'Paid With' : 'Received Into'}
                value={
                  account
                    ? `${account.name}${account.lastFour ? ` ••••${account.lastFour}` : ''}`
                    : '-'
                }
              />
              <Row label="Date" value={formatDisplayDate(transaction.date)} />
              {transaction.description && (
                <Row label="Description" value={transaction.description} />
              )}
              {transaction.location && <Row label="Location" value={transaction.location} />}
              {transaction.notes && <Row label="Notes" value={transaction.notes} />}
              {transaction.tags.length > 0 && (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted-foreground">Tags</dt>
                  <dd className="flex flex-wrap justify-end gap-1">
                    {transaction.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        #{tag}
                      </Badge>
                    ))}
                  </dd>
                </div>
              )}
              <Row label="Transaction ID" value={transaction.id} mono />
            </dl>

            <ReceiptSection transactionId={transaction.id} />

            {transaction.plaidTransactionId ? (
              <p className="bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-xs">
                This transaction was imported from your linked bank and updates automatically -
                it can't be edited or deleted here. Unlink the bank in Settings to stop syncing it.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="flex-col gap-1 py-4"
                  onClick={() => {
                    openEditTransaction(transaction.id)
                  }}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit
                </Button>
                <Button variant="outline" className="flex-col gap-1 py-4" onClick={handleDuplicate}>
                  <Copy className="size-4" aria-hidden="true" />
                  Duplicate
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
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. The account balance will be updated to reflect the removal.
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
