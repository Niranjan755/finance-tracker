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
let applyingRemoteUpdate = false

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
  const revision = crypto.randomUUID()
  lastPushedRevision = revision
  useAuthStore.getState().setSyncStatus('syncing')
  const { error } = await supabase.from(TABLE_NAME).upsert(
    {
      user_id: userId,
      payload: snapshotFromState(),
      revision,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    useAuthStore.getState().setSyncStatus('error', error.message)
    return
  }
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
  await applyRemoteSnapshot(data.payload as AppSnapshot)
  useAuthStore.getState().setSyncStatus('synced')
}

function handleRemoteChange(payload: { new: { payload: AppSnapshot; revision: string } }) {
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
    prevStatus = state.status
    if (state.status === 'signed-in' && state.userId) {
      const userId = state.userId
      startAutoSync(userId)
      pullOnce(userId).finally(() => startRealtimeSubscription(userId))
    } else if (state.status === 'signed-out') {
      stopAutoSync()
      stopRealtimeSubscription()
    }
  })
}
