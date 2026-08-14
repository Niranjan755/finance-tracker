import { create } from 'zustand'
import { supabase } from '@/lib/supabase/client'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in'
  userId: string | null
  userEmail: string | null
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  syncError: string | null

  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setSyncStatus: (status: SyncStatus, error?: string | null) => void
  _init: () => void
}

let initialized = false

export const useAuthStore = create<AuthState>((set, get) => ({
  status: supabase ? 'loading' : 'signed-out',
  userId: null,
  userEmail: null,
  syncStatus: 'idle',
  lastSyncedAt: null,
  syncError: null,

  async signUp(email, password) {
    if (!supabase) throw new Error('Cloud sync is not configured')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
  },

  async signIn(email, password) {
    if (!supabase) throw new Error('Cloud sync is not configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  },

  async signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  },

  setSyncStatus(status, error = null) {
    set({
      syncStatus: status,
      syncError: error,
      lastSyncedAt: status === 'synced' ? new Date().toISOString() : get().lastSyncedAt,
    })
  },

  _init() {
    if (initialized || !supabase) return
    initialized = true

    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      if (user) {
        set({ status: 'signed-in', userId: user.id, userEmail: user.email ?? null })
      } else {
        set({ status: 'signed-out', userId: null, userEmail: null, syncStatus: 'idle' })
      }
    })
  },
}))
