import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Pencil, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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
import { EmptyState } from '@/components/finance/EmptyState'
import { AccountForm } from '@/features/accounts/AccountForm'
import { TransactionRow } from '@/features/transactions/TransactionRow'
import { useFinanceStore } from '@/store/financeStore'
import { getIcon } from '@/lib/icons'
import { availableCredit, creditUtilization } from '@/lib/finance/math'
import { formatCurrency } from '@/lib/money'
import { formatDisplayDate } from '@/lib/date'
import { ACCOUNT_TYPE_LABELS } from '@/lib/validation/account'
import { toCents } from '@/lib/money'
import type { AccountFormValues } from '@/lib/validation/account'

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accounts = useFinanceStore((s) => s.accounts)
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const updateAccount = useFinanceStore((s) => s.updateAccount)
  const removeAccount = useFinanceStore((s) => s.removeAccount)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const account = accounts.find((a) => a.id === id)
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountTransactions = useMemo(
    () =>
      transactions
        .filter((t) => t.accountId === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [transactions, id],
  )

  if (!account) {
    return <Navigate to="/accounts" replace />
  }

  const Icon = getIcon(account.icon)
  const isCreditCard = account.type === 'credit_card'
  const limit = account.creditLimitCents ?? 0
  const available = isCreditCard ? availableCredit(limit, account.balanceCents) : 0
  const utilization = isCreditCard ? creditUtilization(limit, account.balanceCents) : 0

  async function handleSubmit(values: AccountFormValues) {
    if (!account) return
    await updateAccount(account.id, {
      name: values.name,
      institution: values.institution,
      type: values.type,
      lastFour: values.lastFour,
      creditLimitCents: values.type === 'credit_card' ? toCents(values.creditLimit) : null,
      statementBalanceCents:
        values.type === 'credit_card' && values.statementBalance ? toCents(values.statementBalance) : null,
      minimumPaymentCents:
        values.type === 'credit_card' && values.minimumPayment ? toCents(values.minimumPayment) : null,
      paymentDueDate: values.type === 'credit_card' && values.paymentDueDate ? values.paymentDueDate : null,
      currency: values.currency,
      icon: values.icon,
      color: values.color,
      notes: values.notes,
    })
    toast.success('Account updated')
    setEditOpen(false)
  }

  async function handleDelete() {
    if (!account) return
    const result = await removeAccount(account.id)
    if (result.deleted) {
      toast.success('Account deleted')
      navigate('/accounts')
    } else {
      toast.error('Unable to delete account', { description: result.reason })
    }
    setDeleteOpen(false)
  }

  return (
    <div>
      <Link to="/accounts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to Accounts
      </Link>

      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl text-white" style={{ backgroundColor: account.color }}>
              <Icon className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {account.institution || ACCOUNT_TYPE_LABELS[account.type]}
              </p>
              <h2 className="text-lg font-semibold">{account.name}</h2>
              <p className="text-xs text-muted-foreground">
                {ACCOUNT_TYPE_LABELS[account.type]} {account.lastFour && `· ••••${account.lastFour}`}
                {!account.isActive && ' · Inactive'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        </div>

        <div className={`mt-5 text-3xl font-semibold tabular-nums ${isCreditCard ? 'text-red-600 dark:text-red-400' : ''}`}>
          {isCreditCard ? '-' : ''}
          {formatCurrency(account.balanceCents, account.currency)}
        </div>

        {isCreditCard && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Credit Limit" value={formatCurrency(limit, account.currency)} />
              <Stat label="Available Credit" value={formatCurrency(available, account.currency)} />
              <Stat
                label="Statement Balance"
                value={account.statementBalanceCents != null ? formatCurrency(account.statementBalanceCents, account.currency) : '-'}
              />
              <Stat
                label="Minimum Payment"
                value={account.minimumPaymentCents != null ? formatCurrency(account.minimumPaymentCents, account.currency) : '-'}
              />
            </div>
            <div>
              <Progress
                value={Math.min(utilization, 100)}
                className={utilization > 90 ? '[&>div]:bg-red-500' : utilization > 75 ? '[&>div]:bg-amber-500' : ''}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {utilization.toFixed(1)}% utilization
                {account.paymentDueDate && ` · Due ${formatDisplayDate(account.paymentDueDate)}`}
              </p>
            </div>
          </div>
        )}

        {account.notes && <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">{account.notes}</p>}
      </Card>

      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Transactions</h3>
      {accountTransactions.length === 0 ? (
        <EmptyState icon={Receipt} title="No transactions yet" description="Transactions for this account will show up here." />
      ) : (
        <Card className="divide-y p-1">
          {accountTransactions.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              category={categoryById.get(t.categoryId)}
              account={account}
              showAccount={false}
              onClick={() => navigate(`/transactions?highlight=${t.id}`)}
            />
          ))}
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <AccountForm account={account} onSubmit={handleSubmit} onCancel={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {account.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Accounts with transaction history can't be deleted - deactivate them instead.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  )
}
