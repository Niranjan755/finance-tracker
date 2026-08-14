import { getDB } from '@/lib/db/client'
import { generateId } from '@/lib/id'
import type { Account, Transaction, TransactionType } from '@/types'
import { assertPositiveAmount, creditDelta, debitDelta } from './math'

export interface TransactionInput {
  accountId: string
  categoryId: string
  type: TransactionType
  amountCents: number
  date: string
  merchant?: string
  description?: string
  notes?: string
  tags?: string[]
  location?: string
  recurringId?: string | null
}

/** The delta a transaction of this type applies to its account's balance. */
function transactionDelta(type: TransactionType, account: Account, amountCents: number): number {
  return type === 'expense'
    ? debitDelta(account.type, amountCents)
    : creditDelta(account.type, amountCents)
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  assertPositiveAmount(input.amountCents)
  const db = await getDB()
  const tx = db.transaction(['accounts', 'transactions'], 'readwrite')
  const accountsStore = tx.objectStore('accounts')

  const account = await accountsStore.get(input.accountId)
  if (!account) throw new Error('Account not found')

  const now = new Date().toISOString()
  const updatedAccount: Account = {
    ...account,
    balanceCents: account.balanceCents + transactionDelta(input.type, account, input.amountCents),
    updatedAt: now,
  }
  const transaction: Transaction = {
    id: generateId('txn'),
    accountId: input.accountId,
    categoryId: input.categoryId,
    type: input.type,
    amountCents: input.amountCents,
    merchant: input.merchant ?? '',
    description: input.description ?? '',
    date: input.date,
    notes: input.notes ?? '',
    tags: input.tags ?? [],
    location: input.location ?? '',
    receiptId: null,
    recurringId: input.recurringId ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await Promise.all([
    accountsStore.put(updatedAccount),
    tx.objectStore('transactions').put(transaction),
    tx.done,
  ])

  return transaction
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
  assertPositiveAmount(input.amountCents)
  const db = await getDB()
  const tx = db.transaction(['accounts', 'transactions'], 'readwrite')
  const accountsStore = tx.objectStore('accounts')
  const transactionsStore = tx.objectStore('transactions')

  const existing = await transactionsStore.get(id)
  if (!existing) throw new Error('Transaction not found')

  const oldAccount = await accountsStore.get(existing.accountId)
  if (!oldAccount) throw new Error('Account not found')

  const now = new Date().toISOString()
  // Reverse the transaction's original effect on its original account.
  const reversal = -transactionDelta(existing.type, oldAccount, existing.amountCents)

  let targetAccount: Account
  if (input.accountId === existing.accountId) {
    targetAccount = { ...oldAccount, balanceCents: oldAccount.balanceCents + reversal }
  } else {
    const revertedOld: Account = {
      ...oldAccount,
      balanceCents: oldAccount.balanceCents + reversal,
      updatedAt: now,
    }
    await accountsStore.put(revertedOld)
    const newAccount = await accountsStore.get(input.accountId)
    if (!newAccount) throw new Error('Account not found')
    targetAccount = newAccount
  }

  const updatedAccount: Account = {
    ...targetAccount,
    balanceCents:
      targetAccount.balanceCents + transactionDelta(input.type, targetAccount, input.amountCents),
    updatedAt: now,
  }

  const updatedTransaction: Transaction = {
    ...existing,
    accountId: input.accountId,
    categoryId: input.categoryId,
    type: input.type,
    amountCents: input.amountCents,
    date: input.date,
    merchant: input.merchant ?? '',
    description: input.description ?? '',
    notes: input.notes ?? '',
    tags: input.tags ?? [],
    location: input.location ?? '',
    recurringId: input.recurringId ?? existing.recurringId,
    updatedAt: now,
  }

  await Promise.all([
    accountsStore.put(updatedAccount),
    transactionsStore.put(updatedTransaction),
    tx.done,
  ])

  return updatedTransaction
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['accounts', 'transactions', 'receipts'], 'readwrite')
  const transactionsStore = tx.objectStore('transactions')
  const accountsStore = tx.objectStore('accounts')
  const receiptsStore = tx.objectStore('receipts')

  const existing = await transactionsStore.get(id)
  if (!existing) throw new Error('Transaction not found')

  const account = await accountsStore.get(existing.accountId)
  if (account) {
    const reversal = -transactionDelta(existing.type, account, existing.amountCents)
    await accountsStore.put({
      ...account,
      balanceCents: account.balanceCents + reversal,
      updatedAt: new Date().toISOString(),
    })
  }

  await transactionsStore.delete(id)
  if (existing.receiptId) {
    await receiptsStore.delete(existing.receiptId)
  }
  await tx.done
}
