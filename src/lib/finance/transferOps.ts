import { getDB } from '@/lib/db/client'
import { generateId } from '@/lib/id'
import type { Account, Transfer } from '@/types'
import { assertPositiveAmount, creditDelta, debitDelta } from './math'

export interface TransferInput {
  fromAccountId: string
  toAccountId: string
  fromAmountCents: number
  toAmountCents: number
  exchangeRate: number
  date: string
  description?: string
  isCreditCardPayment?: boolean
}

export async function createTransfer(input: TransferInput): Promise<Transfer> {
  assertPositiveAmount(input.fromAmountCents)
  assertPositiveAmount(input.toAmountCents)
  if (input.exchangeRate <= 0) {
    throw new Error('Exchange rate must be positive')
  }
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
    balanceCents: fromAccount.balanceCents + debitDelta(fromAccount.type, input.fromAmountCents),
    updatedAt: now,
  }
  const updatedTo: Account = {
    ...toAccount,
    balanceCents: toAccount.balanceCents + creditDelta(toAccount.type, input.toAmountCents),
    updatedAt: now,
  }
  const transfer: Transfer = {
    id: generateId('xfer'),
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    fromAmountCents: input.fromAmountCents,
    toAmountCents: input.toAmountCents,
    exchangeRate: input.exchangeRate,
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

export async function updateTransfer(id: string, patch: TransferInput): Promise<Transfer> {
  assertPositiveAmount(patch.fromAmountCents)
  assertPositiveAmount(patch.toAmountCents)
  if (patch.exchangeRate <= 0) {
    throw new Error('Exchange rate must be positive')
  }
  if (patch.fromAccountId === patch.toAccountId) {
    throw new Error('Transfer source and destination accounts must be different')
  }

  const db = await getDB()
  const tx = db.transaction(['accounts', 'transfers'], 'readwrite')
  const transfersStore = tx.objectStore('transfers')
  const accountsStore = tx.objectStore('accounts')

  const existing = await transfersStore.get(id)
  if (!existing) throw new Error('Transfer not found')

  const accountIds = [
    ...new Set([
      existing.fromAccountId,
      existing.toAccountId,
      patch.fromAccountId,
      patch.toAccountId,
    ]),
  ]
  const accounts = await Promise.all(accountIds.map((accId) => accountsStore.get(accId)))
  const accountById = new Map(
    accounts.filter((a): a is Account => !!a).map((a) => [a.id, a]),
  )

  // Net delta per account: reverse the old transfer's effect, then apply the new
  // one. Accumulating into the same map (rather than writing twice) handles the
  // case where an account plays a role in both the old and new transfer.
  const deltas = new Map<string, number>()
  function addDelta(accountId: string, amount: number) {
    deltas.set(accountId, (deltas.get(accountId) ?? 0) + amount)
  }

  const oldFrom = accountById.get(existing.fromAccountId)
  if (oldFrom) addDelta(existing.fromAccountId, -debitDelta(oldFrom.type, existing.fromAmountCents))
  const oldTo = accountById.get(existing.toAccountId)
  if (oldTo) addDelta(existing.toAccountId, -creditDelta(oldTo.type, existing.toAmountCents))

  const newFrom = accountById.get(patch.fromAccountId)
  if (!newFrom) throw new Error('Source account not found')
  addDelta(patch.fromAccountId, debitDelta(newFrom.type, patch.fromAmountCents))
  const newTo = accountById.get(patch.toAccountId)
  if (!newTo) throw new Error('Destination account not found')
  addDelta(patch.toAccountId, creditDelta(newTo.type, patch.toAmountCents))

  const now = new Date().toISOString()
  const updated: Transfer = {
    ...existing,
    fromAccountId: patch.fromAccountId,
    toAccountId: patch.toAccountId,
    fromAmountCents: patch.fromAmountCents,
    toAmountCents: patch.toAmountCents,
    exchangeRate: patch.exchangeRate,
    date: patch.date,
    description: patch.description ?? '',
    isCreditCardPayment: patch.isCreditCardPayment ?? false,
  }

  const writes = [...deltas.entries()].map(([accountId, delta]) => {
    const account = accountById.get(accountId)!
    return accountsStore.put({ ...account, balanceCents: account.balanceCents + delta, updatedAt: now })
  })

  await Promise.all([...writes, transfersStore.put(updated), tx.done])

  return updated
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
        balanceCents: fromAccount.balanceCents - debitDelta(fromAccount.type, existing.fromAmountCents),
        updatedAt: now,
      }),
    )
  }
  if (toAccount) {
    writes.push(
      accountsStore.put({
        ...toAccount,
        balanceCents: toAccount.balanceCents - creditDelta(toAccount.type, existing.toAmountCents),
        updatedAt: now,
      }),
    )
  }
  writes.push(transfersStore.delete(id))
  writes.push(tx.done)
  await Promise.all(writes)
}

/** Reverses deleteTransfer: reinserts the transfer and reapplies both accounts' balance deltas. */
export async function restoreTransfer(transfer: Transfer): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['accounts', 'transfers'], 'readwrite')
  const transfersStore = tx.objectStore('transfers')
  const accountsStore = tx.objectStore('accounts')

  const [fromAccount, toAccount] = await Promise.all([
    accountsStore.get(transfer.fromAccountId),
    accountsStore.get(transfer.toAccountId),
  ])
  const now = new Date().toISOString()
  const writes: Promise<unknown>[] = []
  if (fromAccount) {
    writes.push(
      accountsStore.put({
        ...fromAccount,
        balanceCents:
          fromAccount.balanceCents + debitDelta(fromAccount.type, transfer.fromAmountCents),
        updatedAt: now,
      }),
    )
  }
  if (toAccount) {
    writes.push(
      accountsStore.put({
        ...toAccount,
        balanceCents: toAccount.balanceCents + creditDelta(toAccount.type, transfer.toAmountCents),
        updatedAt: now,
      }),
    )
  }
  writes.push(transfersStore.put(transfer))
  writes.push(tx.done)
  await Promise.all(writes)
}
