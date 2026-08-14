import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFinanceStore } from '@/store/financeStore'
import { useUIStore } from '@/store/uiStore'
import { ExpenseIncomeForm } from './ExpenseIncomeForm'
import { TransferForm } from './TransferForm'
import type { TransactionFormInput, TransferFormInput } from '@/store/financeStore'

export function TransactionDialog() {
  const addOpen = useUIStore((s) => s.addTransactionOpen)
  const defaultType = useUIStore((s) => s.addTransactionDefaultType)
  const defaultAccountId = useUIStore((s) => s.addTransactionDefaultAccountId)
  const closeAdd = useUIStore((s) => s.closeAddTransaction)

  const editTransactionId = useUIStore((s) => s.editTransactionId)
  const closeEditTransaction = useUIStore((s) => s.closeEditTransaction)
  const editTransferId = useUIStore((s) => s.editTransferId)
  const closeEditTransfer = useUIStore((s) => s.closeEditTransfer)

  const accounts = useFinanceStore((s) => s.accounts)
  const categories = useFinanceStore((s) => s.categories)
  const transactions = useFinanceStore((s) => s.transactions)
  const transfers = useFinanceStore((s) => s.transfers)
  const addExpense = useFinanceStore((s) => s.addExpense)
  const addIncome = useFinanceStore((s) => s.addIncome)
  const editTransaction = useFinanceStore((s) => s.editTransaction)
  const addTransfer = useFinanceStore((s) => s.addTransfer)

  const [tab, setTab] = useState<'expense' | 'income' | 'transfer'>(
    defaultType === 'transfer' ? 'transfer' : defaultType,
  )

  // The dialog stays mounted between opens, so the tab must be re-synced to
  // whichever type was requested each time it's opened in "add" mode.
  useEffect(() => {
    if (addOpen) {
      setTab(defaultType === 'transfer' ? 'transfer' : defaultType)
    }
  }, [addOpen, defaultType])

  const editingTransaction = editTransactionId
    ? transactions.find((t) => t.id === editTransactionId)
    : undefined
  const editingTransfer = editTransferId
    ? transfers.find((t) => t.id === editTransferId)
    : undefined

  const isOpen = addOpen || !!editTransactionId || !!editTransferId

  function handleOpenChange(open: boolean) {
    if (open) return
    closeAdd()
    closeEditTransaction()
    closeEditTransfer()
  }

  async function handleTransactionSubmit(type: 'expense' | 'income', values: TransactionFormInput) {
    try {
      if (editingTransaction) {
        await editTransaction(editingTransaction.id, values)
        toast.success('Transaction updated')
      } else if (type === 'expense') {
        await addExpense(values)
        toast.success('Expense added')
      } else {
        await addIncome(values)
        toast.success('Income added')
      }
      handleOpenChange(false)
    } catch (err) {
      toast.error('Unable to save transaction', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    }
  }

  async function handleTransferSubmit(values: TransferFormInput) {
    try {
      await addTransfer(values)
      toast.success('Transfer completed')
      handleOpenChange(false)
    } catch (err) {
      toast.error('Unable to complete transfer', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    }
  }

  const title = editingTransaction
    ? 'Edit Transaction'
    : editingTransfer
      ? 'Edit Transfer'
      : 'Add Transaction'

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {editingTransfer ? (
          <TransferForm
            accounts={accounts}
            transfer={editingTransfer}
            onSubmit={handleTransferSubmit}
            onCancel={() => handleOpenChange(false)}
          />
        ) : editingTransaction ? (
          <ExpenseIncomeForm
            type={editingTransaction.type}
            accounts={accounts}
            categories={categories}
            transaction={editingTransaction}
            onSubmit={(values) => handleTransactionSubmit(editingTransaction.type, values)}
            onCancel={() => handleOpenChange(false)}
          />
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="w-full">
              <TabsTrigger value="expense" className="flex-1">
                Expense
              </TabsTrigger>
              <TabsTrigger value="income" className="flex-1">
                Income
              </TabsTrigger>
              <TabsTrigger value="transfer" className="flex-1">
                Transfer
              </TabsTrigger>
            </TabsList>
            <TabsContent value="expense" className="pt-4">
              <ExpenseIncomeForm
                type="expense"
                accounts={accounts}
                categories={categories}
                defaultAccountId={defaultAccountId}
                onSubmit={(values) => handleTransactionSubmit('expense', values)}
                onCancel={() => handleOpenChange(false)}
              />
            </TabsContent>
            <TabsContent value="income" className="pt-4">
              <ExpenseIncomeForm
                type="income"
                accounts={accounts}
                categories={categories}
                defaultAccountId={defaultAccountId}
                onSubmit={(values) => handleTransactionSubmit('income', values)}
                onCancel={() => handleOpenChange(false)}
              />
            </TabsContent>
            <TabsContent value="transfer" className="pt-4">
              <TransferForm
                accounts={accounts}
                onSubmit={handleTransferSubmit}
                onCancel={() => handleOpenChange(false)}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
