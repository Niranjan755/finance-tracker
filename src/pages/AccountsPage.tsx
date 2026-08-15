import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/finance/PageHeader'
import { EmptyState } from '@/components/finance/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { AccountCard } from '@/features/accounts/AccountCard'
import { AccountForm } from '@/features/accounts/AccountForm'
import { useFinanceStore } from '@/store/financeStore'
import { computeAccountTotals } from '@/lib/finance/calculations'
import { toCents } from '@/lib/money'
import { MoneyText } from '@/components/finance/MoneyText'
import type { Account } from '@/types'
import type { AccountFormValues } from '@/lib/validation/account'

export function AccountsPage() {
  const accounts = useFinanceStore((s) => s.accounts)
  const currency = useFinanceStore((s) => s.settings.currency)
  const addAccount = useFinanceStore((s) => s.addAccount)
  const updateAccount = useFinanceStore((s) => s.updateAccount)
  const removeAccount = useFinanceStore((s) => s.removeAccount)

  const [formOpen, setFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)

  const totals = computeAccountTotals(accounts, currency)
  const totalsByCurrency = Object.values(totals.byCurrency).filter(
    (group) => group.totalAssetsCents > 0 || group.totalLiabilitiesCents > 0,
  )
  const liquid = accounts.filter((a) => a.type !== 'credit_card')
  const creditCards = accounts.filter((a) => a.type === 'credit_card')

  function openAdd() {
    setEditingAccount(undefined)
    setFormOpen(true)
  }

  function openEdit(account: Account) {
    setEditingAccount(account)
    setFormOpen(true)
  }

  async function handleSubmit(values: AccountFormValues) {
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          name: values.name,
          institution: values.institution,
          type: values.type,
          lastFour: values.lastFour,
          creditLimitCents: values.type === 'credit_card' ? toCents(values.creditLimit) : null,
          statementBalanceCents:
            values.type === 'credit_card' && values.statementBalance
              ? toCents(values.statementBalance)
              : null,
          minimumPaymentCents:
            values.type === 'credit_card' && values.minimumPayment
              ? toCents(values.minimumPayment)
              : null,
          paymentDueDate:
            values.type === 'credit_card' && values.paymentDueDate ? values.paymentDueDate : null,
          currency: values.currency,
          icon: values.icon,
          color: values.color,
          notes: values.notes,
        })
        toast.success('Account updated')
      } else {
        await addAccount({
          name: values.name,
          institution: values.institution,
          type: values.type,
          lastFour: values.lastFour,
          startingBalanceCents: toCents(values.startingBalance),
          creditLimitCents: values.type === 'credit_card' ? toCents(values.creditLimit) : null,
          currency: values.currency,
          icon: values.icon,
          color: values.color,
          notes: values.notes,
        })
        toast.success('Account added')
      }
      setFormOpen(false)
    } catch (err) {
      toast.error('Unable to save account', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function handleDelete() {
    if (!deletingAccount) return
    const result = await removeAccount(deletingAccount.id)
    if (result.deleted) {
      toast.success('Account deleted')
    } else {
      toast.error('Unable to delete account', { description: result.reason })
    }
    setDeletingAccount(null)
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Everything you own and owe, in one place."
        actions={
          <Button onClick={openAdd} className="gap-1.5">
            <Plus className="size-4" aria-hidden="true" />
            Add Account
          </Button>
        }
      />

      {accounts.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {totalsByCurrency.length > 0 ? (
            totalsByCurrency.map((group) => (
              <Card key={group.currency} className="p-4">
                <p className="text-muted-foreground text-xs font-medium">{group.currency} Net Worth</p>
                <MoneyText
                  cents={group.netWorthCents}
                  kind="neutral"
                  signed={false}
                  currency={group.currency}
                  className="text-xl font-semibold"
                />
              </Card>
            ))
          ) : (
            <>
              <Card className="p-4">
                <p className="text-muted-foreground text-xs font-medium">Total Assets</p>
                <MoneyText
                  cents={totals.totalAssetsCents}
                  kind="neutral"
                  signed={false}
                  className="text-xl font-semibold"
                />
              </Card>
              <Card className="p-4">
                <p className="text-muted-foreground text-xs font-medium">Total Liabilities</p>
                <MoneyText
                  cents={totals.totalLiabilitiesCents}
                  kind="neutral"
                  signed={false}
                  className="text-xl font-semibold"
                />
              </Card>
              <Card className="p-4">
                <p className="text-muted-foreground text-xs font-medium">Net Worth</p>
                <MoneyText
                  cents={totals.netWorthCents}
                  kind="neutral"
                  signed={false}
                  className="text-xl font-semibold"
                />
              </Card>
            </>
          )}
        </div>
      )}

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your first checking, savings, cash, or credit card account to start tracking your money."
          action={
            <Button onClick={openAdd} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              Add Account
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {liquid.length > 0 && (
            <section>
              <h3 className="text-muted-foreground mb-3 text-sm font-medium">Cash &amp; Bank</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {liquid.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={() => openEdit(account)}
                    onDeactivate={() => updateAccount(account.id, { isActive: false })}
                    onReactivate={() => updateAccount(account.id, { isActive: true })}
                    onDelete={() => setDeletingAccount(account)}
                  />
                ))}
              </div>
            </section>
          )}

          {creditCards.length > 0 && (
            <section>
              <h3 className="text-muted-foreground mb-3 text-sm font-medium">Credit Cards</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {creditCards.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={() => openEdit(account)}
                    onDeactivate={() => updateAccount(account.id, { isActive: false })}
                    onReactivate={() => updateAccount(account.id, { isActive: true })}
                    onDelete={() => setDeletingAccount(account)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          <AccountForm
            account={editingAccount}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingAccount}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingAccount?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Accounts with transaction history can't be deleted - deactivate
              them instead.
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
