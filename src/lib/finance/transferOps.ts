import { getDB } from '@/lib/db/client'
import { generateId } from '@/lib/id'
import type { Account, Transfer } from '@/types'
import { assertPositiveAmount, creditDelta, debitDelta } from './math'

export interface TransferInput {
  fromAccountId: string
  toAccountId: string
  amountCents: number
  date: string
  description?: string
  isCreditCardPayment?: boolean
}

export async function createTransfer(input: TransferInput): Promise<Transfer> {
  assertPositiveAmount(input.amountCents)
  if (input.fromAccountId === input.toAccountId) {
    throw new Error('Transfer source and destination accounts must be different')
  }

  const db = await getDB()
  const tx = db.transaction(['accounts', 'transfers'], 'readwrite')
  const accountsStore = tx.objectStore('accounts')

  const [fromAccount, toAccount] = await Promise.all([
    accountsStore.get(input.fromAccountId),
    accountsStore.get(input.toAccountId),
  ])
  if (!fromAccount) throw new Error('Source account not found')
  if (!toAccount) throw new Error('Destination account not found')

  const now = new Date().toISOString()
  const updatedFrom: Account = {
    ...fromAccount,
    balanceCents: fromAccount.balanceCents + debitDelta(fromAccount.type, input.amountCents),
    updatedAt: now,
  }
  const updatedTo: Account = {
    ...toAccount,
    balanceCents: toAccount.balanceCents + creditDelta(toAccount.type, input.amountCents),
    updatedAt: now,
  }
  const transfer: Transfer = {
    id: generateId('xfer'),
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amountCents: input.amountCents,
    date: input.date,
    description: input.description ?? '',
    isCreditCardPayment: input.isCreditCardPayment ?? false,
    createdAt: now,
  }

  await Promise.all([
    accountsStore.put(updatedFrom),
    accountsStore.put(updatedTo),
    tx.objectStore('transfers').put(transfer),
    tx.done,
  ])

  return transfer
}

export async function deleteTransfer(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['accounts', 'transfers'], 'readwrite')
  const transfersStore = tx.objectStore('transfers')
  const accountsStore = tx.objectStore('accounts')

  const existing = await transfersStore.get(id)
  if (!existing) throw new Error('Transfer not found')

  const [fromAccount, toAccount] = await Promise.all([
    accountsStore.get(existing.fromAccountId),
    accountsStore.get(existing.toAccountId),
  ])
  const now = new Date().toISOString()
  const writes: Promise<unknown>[] = []
  if (fromAccount) {
    writes.push(
      accountsStore.put({
        ...fromAccount,
        balanceCents: fromAccount.balanceCents - debitDelta(fromAccount.type, existing.amountCents),
        updatedAt: now,
      }),
    )
  }
  if (toAccount) {
    writes.push(
      accountsStore.put({
        ...toAccount,
        balanceCents: toAccount.balanceCents - creditDelta(toAccount.type, existing.amountCents),
        updatedAt: now,
      }),
    )
  }
  writes.push(transfersStore.delete(id))
  writes.push(tx.done)
  await Promise.all(writes)
}
