import { closeDBConnection, getDB } from '@/lib/db/client'
import { DB_NAME } from '@/lib/db/schema'
import type { Account } from '@/types'

/** Wipes the fake-indexeddb-backed database so each test starts from a clean slate. */
export async function resetTestDB(): Promise<void> {
  await closeDBConnection()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error as unknown as Error)
    req.onblocked = () => resolve()
  })
}

export async function seedAccount(overrides: Partial<Account> = {}): Promise<Account> {
  const db = await getDB()
  const account: Account = {
    id: overrides.id ?? `acct_${Math.random().toString(36).slice(2)}`,
    name: 'Test Account',
    institution: 'Test Bank',
    type: 'checking',
    lastFour: '0000',
    balanceCents: 0,
    creditLimitCents: null,
    statementBalanceCents: null,
    minimumPaymentCents: null,
    paymentDueDate: null,
    currency: 'USD',
    icon: 'landmark',
    color: '#6366f1',
    isActive: true,
    notes: '',
    plaidAccountId: null,
    plaidItemId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  }
  await db.put('accounts', account)
  return account
}

export async function getAccount(id: string): Promise<Account> {
  const db = await getDB()
  const account = await db.get('accounts', id)
  if (!account) throw new Error(`Account ${id} not found in test DB`)
  return account
}
