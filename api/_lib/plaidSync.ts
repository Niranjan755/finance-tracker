import type { RemovedTransaction, Transaction as PlaidTransaction } from 'plaid'
import { getPlaidClient } from './plaid'
import { getServiceClient } from './supabase'
import { loadAppState, saveAppState, upsertTransactions, type AppSnapshot } from './appState'
import { mapPlaidCategory } from './categoryMap'
import { refreshAppAccount } from './plaidAccount'
import type { Transaction } from '../../src/types'

function toAppTransaction(t: PlaidTransaction): Transaction {
  const isIncome = t.amount < 0
  const now = new Date().toISOString()
  return {
    id: `plaid_txn_${t.transaction_id}`,
    accountId: `plaid_${t.account_id}`,
    categoryId: mapPlaidCategory(t.personal_finance_category?.primary, isIncome),
    type: isIncome ? 'income' : 'expense',
    amountCents: Math.round(Math.abs(t.amount) * 100),
    merchant: t.merchant_name ?? t.name ?? '',
    description: t.name ?? '',
    date: t.date,
    notes: '',
    tags: [],
    location: '',
    receiptId: null,
    recurringId: null,
    plaidTransactionId: t.transaction_id,
    createdAt: now,
    updatedAt: now,
  }
}

export interface SyncResult {
  added: number
  modified: number
  removed: number
}

/**
 * Pulls everything new since the last sync for one Plaid Item (bank
 * connection) and merges it into the user's app_state snapshot - the same
 * row/mechanism the client's own cross-device sync uses, so this shows up
 * live via the client's existing Realtime subscription with no new
 * client-side code.
 */
export async function syncPlaidItem(itemId: string): Promise<SyncResult> {
  const supabase = getServiceClient()
  const plaid = getPlaidClient()

  const { data: item, error: itemError } = await supabase
    .from('plaid_items')
    .select('user_id, access_token, cursor')
    .eq('item_id', itemId)
    .maybeSingle()
  if (itemError) throw new Error(itemError.message)
  if (!item) throw new Error(`No plaid_items row for item_id ${itemId}`)

  const added: PlaidTransaction[] = []
  const modified: PlaidTransaction[] = []
  const removed: RemovedTransaction[] = []
  let cursor: string | null = item.cursor
  let hasMore = true

  while (hasMore) {
    const response = await plaid.transactionsSync({
      access_token: item.access_token,
      cursor: cursor ?? undefined,
    })
    added.push(...response.data.added)
    modified.push(...response.data.modified)
    removed.push(...response.data.removed)
    cursor = response.data.next_cursor
    hasMore = response.data.has_more
  }

  const accountsResponse = await plaid.accountsGet({ access_token: item.access_token })

  let payload: AppSnapshot = await loadAppState(supabase, item.user_id)

  const newTransactions = [...added, ...modified].map(toAppTransaction)
  payload = upsertTransactions(payload, newTransactions)

  const removedIds = new Set(removed.map((r) => r.transaction_id).filter((id): id is string => !!id))
  if (removedIds.size > 0) {
    payload = {
      ...payload,
      transactions: payload.transactions.filter(
        (t) => !t.plaidTransactionId || !removedIds.has(t.plaidTransactionId),
      ),
    }
  }

  const accountById = new Map(payload.accounts.map((a) => [a.id, a]))
  for (const plaidAccount of accountsResponse.data.accounts) {
    const localId = `plaid_${plaidAccount.account_id}`
    const existing = accountById.get(localId)
    if (existing) {
      accountById.set(localId, refreshAppAccount(existing, plaidAccount))
    }
  }
  payload = { ...payload, accounts: [...accountById.values()] }

  await saveAppState(supabase, item.user_id, payload)

  const { error: cursorError } = await supabase
    .from('plaid_items')
    .update({ cursor, updated_at: new Date().toISOString() })
    .eq('item_id', itemId)
  if (cursorError) throw new Error(cursorError.message)

  return { added: added.length, modified: modified.length, removed: removed.length }
}
