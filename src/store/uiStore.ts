import { create } from 'zustand'
import type { TransactionType } from '@/types'

interface UIState {
  addTransactionOpen: boolean
  addTransactionDefaultType: TransactionType | 'transfer'
  addTransactionDefaultAccountId: string | null
  openAddTransaction: (type?: TransactionType | 'transfer', accountId?: string) => void
  closeAddTransaction: () => void

  editTransactionId: string | null
  openEditTransaction: (id: string) => void
  closeEditTransaction: () => void

  editTransferId: string | null
  openEditTransfer: (id: string) => void
  closeEditTransfer: () => void

  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  addTransactionOpen: false,
  addTransactionDefaultType: 'expense',
  addTransactionDefaultAccountId: null,
  openAddTransaction: (type = 'expense', accountId) =>
    set({
      addTransactionOpen: true,
      addTransactionDefaultType: type,
      addTransactionDefaultAccountId: accountId ?? null,
    }),
  closeAddTransaction: () => set({ addTransactionOpen: false }),

  editTransactionId: null,
  openEditTransaction: (id) => set({ editTransactionId: id }),
  closeEditTransaction: () => set({ editTransactionId: null }),

  editTransferId: null,
  openEditTransfer: (id) => set({ editTransferId: id }),
  closeEditTransfer: () => set({ editTransferId: null }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}))
