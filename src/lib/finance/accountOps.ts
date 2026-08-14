import { getDB } from '@/lib/db/client'
import { generateId } from '@/lib/id'
import type { Account } from '@/types'

export interface CreateAccountInput {
  name: string
  institution: string
  type: Account['type']
  lastFour: string
  startingBalanceCents: number
  creditLimitCents: number | null
  currency: Account['currency']
  icon: string
  color: string
  notes: string
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const now = new Date().toISOString()
  const account: Account = {
    id: generateId('acct'),
    name: input.name,
    institution: input.institution,
    type: input.type,
    lastFour: input.lastFour,
    balanceCents: input.startingBalanceCents,
    creditLimitCents: input.creditLimitCents,
    currency: input.currency,
    icon: input.icon,
    color: input.color,
    isActive: true,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  }
  const db = await getDB()
  await db.put('accounts', account)
  return account
}

/**
 * Metadata-only edit. `balanceCents` is deliberately excluded: it must only
 * ever change through createTransaction/createTransfer so it always stays
 * mathematically derived from transaction history.
 */
export type AccountMetaPatch = Partial<
  Omit<Account, 'id' | 'balanceCents' | 'createdAt' | 'updatedAt'>
>

export async function updateAccountMeta(id: string, patch: AccountMetaPatch): Promise<Account> {
  const db = await getDB()
  const existing = await db.get('accounts', id)
  if (!existing) throw new Error('Account not found')
  const updated: Account = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  await db.put('accounts', updated)
  return updated
}

export interface DeleteAccountResult {
  deleted: boolean
  reason?: string
}

/** Refuses to delete an account with transaction/transfer history to protect referential integrity. */
export async function deleteAccountIfUnused(id: string): Promise<DeleteAccountResult> {
  const db = await getDB()
  const [txnCount, fromCount, toCount] = await Promise.all([
    db.countFromIndex('transactions', 'by-account', id),
    db.countFromIndex('transfers', 'by-fromAccount', id),
    db.countFromIndex('transfers', 'by-toAccount', id),
  ])
  if (txnCount + fromCount + toCount > 0) {
    return {
      deleted: false,
      reason: 'This account has transaction history and cannot be deleted. Deactivate it instead.',
    }
  }
  await db.delete('accounts', id)
  return { deleted: true }
}
