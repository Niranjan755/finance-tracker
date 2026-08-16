import { getDB } from '@/lib/db/client'
import { generateId } from '@/lib/id'
import type { Account, Receipt, Transaction, TransactionType } from '@/types'
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
    plaidTransactionId: null,
    possibleDuplicateOfId: null,
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

  // Validate the target account exists before writing anything, so a missing
  // account can't leave a partial reversal committed (this all runs inside
  // one readwrite transaction, but IndexedDB has no automatic rollback on a
  // thrown error - only an explicit tx.abort() would undo an already-applied
  // put, so the safest fix is to never write until every account is known good).
  const newAccountBeforeWrite =
    input.accountId === existing.accountId ? oldAccount : await accountsStore.get(input.accountId)
  if (!newAccountBeforeWrite) throw new Error('Account not found')

  const now = new Date().toISOString()
  // Reverse the transaction's original effect on its original account.
  const reversal = -transactionDelta(existing.type, oldAccount, existing.amountCents)

  const writes: Promise<unknown>[] = []
  let targetAccount: Account
  if (input.accountId === existing.accountId) {
    targetAccount = { ...oldAccount, balanceCents: oldAccount.balanceCents + reversal }
  } else {
    const revertedOld: Account = {
      ...oldAccount,
      balanceCents: oldAccount.balanceCents + reversal,
      updatedAt: now,
    }
    writes.push(accountsStore.put(revertedOld))
    targetAccount = newAccountBeforeWrite
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

  writes.push(accountsStore.put(updatedAccount))
  writes.push(transactionsStore.put(updatedTransaction))
  writes.push(tx.done)
  await Promise.all(writes)

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

/** Clears a possibleDuplicateOfId flag once the user confirms both transactions are legitimate. */
export async function clearPossibleDuplicate(id: string): Promise<void> {
  const db = await getDB()
  const existing = await db.get('transactions', id)
  if (!existing) throw new Error('Transaction not found')
  await db.put('transactions', {
    ...existing,
    possibleDuplicateOfId: null,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Reverses deleteTransaction: reinserts the transaction (and its receipt, if
 * one was captured before deletion) with its original id/timestamps, and
 * reapplies its balance effect. Used to implement "Undo" after a delete.
 */
export async function restoreTransaction(
  transaction: Transaction,
  receipt?: Receipt | null,
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['accounts', 'transactions', 'receipts'], 'readwrite')
  const accountsStore = tx.objectStore('accounts')
  const account = await accountsStore.get(transaction.accountId)

  const writes: Promise<unknown>[] = []
  if (account) {
    writes.push(
      accountsStore.put({
        ...account,
        balanceCents:
          account.balanceCents + transactionDelta(transaction.type, account, transaction.amountCents),
        updatedAt: new Date().toISOString(),
      }),
    )
  }
  writes.push(tx.objectStore('transactions').put(transaction))
  if (receipt) writes.push(tx.objectStore('receipts').put(receipt))
  writes.push(tx.done)
  await Promise.all(writes)
}
