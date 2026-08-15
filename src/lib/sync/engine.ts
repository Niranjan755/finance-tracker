import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useFinanceStore } from '@/store/financeStore'
import { useAuthStore } from '@/store/authStore'
import type {
  Account,
  Budget,
  Category,
  RecurringTransaction,
  Settings,
  Transaction,
  Transfer,
} from '@/types'

interface AppSnapshot {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  transfers: Transfer[]
  recurring: RecurringTransaction[]
  budgets: Budget[]
  settings: Settings
}

const TABLE_NAME = 'app_state'
const DEBOUNCE_MS = 1500

let unsubscribePush: (() => void) | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
let lastPushedRevision: string | null = null
/** The most recent server revision this device has actually seen (via pull, push, or realtime). */
let lastKnownRemoteRevision: string | null = null
let applyingRemoteUpdate = false

/** True if timestamp `a` is later than `b`. Missing/empty timestamps sort oldest. */
function isNewer(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '') > (b ?? '')
}

/** Unions two arrays by `id`, keeping whichever side has the later `updatedAt`. */
function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(
  local: T[],
  remote: T[],
): T[] {
  const merged = new Map<string, T>(remote.map((item) => [item.id, item]))
  for (const item of local) {
    const existing = merged.get(item.id)
    if (!existing || isNewer(item.updatedAt, existing.updatedAt)) {
      merged.set(item.id, item)
    }
  }
  return [...merged.values()]
}

/** Unions two arrays by `id` with no reliable per-record timestamp - local wins on collision. */
function mergeByIdPreferLocal<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>(remote.map((item) => [item.id, item]))
  for (const item of local) merged.set(item.id, item)
  return [...merged.values()]
}

/**
 * Combines a local and remote snapshot instead of blindly overwriting one with
 * the other, so a device that's behind doesn't silently discard another
 * device's changes it hasn't seen yet. Not a full per-field merge - two
 * genuinely simultaneous edits to the exact same transfer/budget still fall
 * back to "local wins," but that's a far smaller blast radius than clobbering
 * the entire dataset.
 */
function mergeSnapshots(local: AppSnapshot, remote: AppSnapshot): AppSnapshot {
  return {
    accounts: mergeByUpdatedAt(local.accounts, remote.accounts),
    categories: mergeByIdPreferLocal(local.categories, remote.categories),
    transactions: mergeByUpdatedAt(local.transactions, remote.transactions),
    transfers: mergeByIdPreferLocal(local.transfers, remote.transfers),
    recurring: mergeByUpdatedAt(local.recurring, remote.recurring),
    budgets: mergeByIdPreferLocal(local.budgets, remote.budgets),
    settings: local.settings,
  }
}

function snapshotFromState(): AppSnapshot {
  const state = useFinanceStore.getState()
  return {
    accounts: state.accounts,
    categories: state.categories,
    transactions: state.transactions,
    transfers: state.transfers,
    recurring: state.recurring,
    budgets: state.budgets,
    settings: state.settings,
  }
}

async function applyRemoteSnapshot(payload: AppSnapshot) {
  applyingRemoteUpdate = true
  try {
    await useFinanceStore.getState().replaceAllData(payload)
  } finally {
    setTimeout(() => {
      applyingRemoteUpdate = false
    }, 0)
  }
}

async function pushSnapshot(userId: string) {
  if (!supabase) return
  useAuthStore.getState().setSyncStatus('syncing')

  let snapshotToPush = snapshotFromState()

  // Check whether another device has written since we last saw the server's
  // state. If so, merge its changes in before overwriting, instead of
  // silently discarding them.
  const { data: remoteRow } = await supabase
    .from(TABLE_NAME)
    .select('payload, revision')
    .eq('user_id', userId)
    .maybeSingle()
  if (remoteRow && remoteRow.revision !== lastKnownRemoteRevision) {
    const merged = mergeSnapshots(snapshotToPush, remoteRow.payload as AppSnapshot)
    snapshotToPush = merged
    await applyRemoteSnapshot(merged)
  }

  const revision = crypto.randomUUID()
  lastPushedRevision = revision
  const { error } = await supabase.from(TABLE_NAME).upsert(
    {
      user_id: userId,
      payload: snapshotToPush,
      revision,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    useAuthStore.getState().setSyncStatus('error', error.message)
    return
  }
  lastKnownRemoteRevision = revision
  useAuthStore.getState().setSyncStatus('synced')
}

function scheduleDebouncedPush(userId: string) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    pushSnapshot(userId).catch((err) => {
      useAuthStore.getState().setSyncStatus('error', err instanceof Error ? err.message : 'Sync failed')
    })
  }, DEBOUNCE_MS)
}

export function startAutoSync(userId: string) {
  if (unsubscribePush) return
  unsubscribePush = useFinanceStore.subscribe((state) => {
    if (state.status !== 'ready') return
    if (applyingRemoteUpdate) return
    scheduleDebouncedPush(userId)
  })
}

export function stopAutoSync() {
  unsubscribePush?.()
  unsubscribePush = null
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  lastKnownRemoteRevision = null
  lastPushedRevision = null
}

export async function pullOnce(userId: string) {
  if (!supabase) return
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('payload, revision')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    useAuthStore.getState().setSyncStatus('error', error.message)
    return
  }
  if (!data) return
  lastKnownRemoteRevision = data.revision
  await applyRemoteSnapshot(data.payload as AppSnapshot)
  useAuthStore.getState().setSyncStatus('synced')
}

function handleRemoteChange(payload: { new: { payload: AppSnapshot; revision: string } }) {
  lastKnownRemoteRevision = payload.new.revision
  if (payload.new.revision === lastPushedRevision) return
  applyRemoteSnapshot(payload.new.payload)
    .then(() => toast.success('Synced from another device'))
    .catch(() => {
      /* best-effort merge; next push/pull cycle will reconcile */
    })
}

export function startRealtimeSubscription(userId: string) {
  if (!supabase || channel) return
  channel = supabase
    .channel(`app_state_${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE_NAME, filter: `user_id=eq.${userId}` },
      handleRemoteChange,
    )
    .subscribe()
}

export function stopRealtimeSubscription() {
  if (channel && supabase) {
    supabase.removeChannel(channel)
    channel = null
  }
}

let engineInitialized = false

/** Watches auth-store transitions and starts/stops sync accordingly. Call once at app startup. */
export function initSyncEngine() {
  if (engineInitialized) return
  engineInitialized = true
  let prevStatus: string | null = null
  useAuthStore.subscribe((state) => {
    if (state.status === prevStatus) return
    const wasSignedIn = prevStatus === 'signed-in'
    prevStatus = state.status
    if (state.status === 'signed-in' && state.userId) {
      const userId = state.userId
      startAutoSync(userId)
      pullOnce(userId).finally(() => startRealtimeSubscription(userId))
    } else if (state.status === 'signed-out') {
      // stopAutoSync() unsubscribes the push listener synchronously, before any
      // async work below starts - so clearing local data can never itself get
      // pushed to the cloud, even though clearAllData() also calls set().
      stopAutoSync()
      stopRealtimeSubscription()
      // Only clear on an actual sign-out (signed-in -> signed-out), never on the
      // passive first-load resolution for someone who was never signed in
      // (loading -> signed-out) - that transition must not wipe local data.
      if (wasSignedIn) {
        useFinanceStore.getState().clearAllData()
      }
    }
  })
}
