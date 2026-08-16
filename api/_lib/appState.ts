import type { SupabaseClient } from '@supabase/supabase-js'
import { getDefaultCategories } from '../../src/lib/db/seed/categories'
import { DEFAULT_SETTINGS } from '../../src/types'
import type {
  Account,
  Budget,
  Category,
  RecurringTransaction,
  Settings,
  Transaction,
  Transfer,
} from '../../src/types'

/**
 * Mirrors the client's AppSnapshot shape (src/lib/sync/engine.ts) so the
 * server can write into the exact same `app_state` row the client already
 * pulls/subscribes to - this is the whole mechanism that makes a Plaid
 * webhook "automatically" show up in the app with no new client sync code.
 */
export interface AppSnapshot {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  transfers: Transfer[]
  recurring: RecurringTransaction[]
  budgets: Budget[]
  settings: Settings
}

const TABLE_NAME = 'app_state'

function emptySnapshot(): AppSnapshot {
  return {
    accounts: [],
    categories: getDefaultCategories(),
    transactions: [],
    transfers: [],
    recurring: [],
    budgets: [],
    settings: DEFAULT_SETTINGS,
  }
}

/** Loads the user's current snapshot, or a fresh empty one if they've never synced before. */
export async function loadAppState(supabase: SupabaseClient, userId: string): Promise<AppSnapshot> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.payload as AppSnapshot | undefined) ?? emptySnapshot()
}

/** Writes the snapshot back with a fresh revision, exactly like the client's pushSnapshot. */
export async function saveAppState(
  supabase: SupabaseClient,
  userId: string,
  payload: AppSnapshot,
): Promise<void> {
  const { error } = await supabase.from(TABLE_NAME).upsert(
    {
      user_id: userId,
      payload,
      revision: crypto.randomUUID(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)
}

export function upsertAccount(payload: AppSnapshot, account: Account): AppSnapshot {
  const exists = payload.accounts.some((a) => a.id === account.id)
  return {
    ...payload,
    accounts: exists
      ? payload.accounts.map((a) => (a.id === account.id ? account : a))
      : [...payload.accounts, account],
  }
}

export function upsertTransactions(payload: AppSnapshot, transactions: Transaction[]): AppSnapshot {
  const byId = new Map(payload.transactions.map((t) => [t.id, t]))
  for (const t of transactions) byId.set(t.id, t)
  return { ...payload, transactions: [...byId.values()] }
}

export function removeTransactionsByPlaidId(payload: AppSnapshot, plaidTransactionIds: string[]): AppSnapshot {
  const idSet = new Set(plaidTransactionIds)
  return {
    ...payload,
    transactions: payload.transactions.filter(
      (t) => !t.plaidTransactionId || !idSet.has(t.plaidTransactionId),
    ),
  }
}
