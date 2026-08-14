import { create } from 'zustand'
import { getDB } from '@/lib/db/client'
import { todayISODate } from '@/lib/date'
import { deleteFromStore, getAllFromStore, getFromStore, putInStore } from '@/lib/db/repo'
import { getDefaultCategories } from '@/lib/db/seed/categories'
import { seedDemoDataIntoDB } from '@/lib/db/seed/demoData'
import { generateId } from '@/lib/id'
import {
  createAccount,
  deleteAccountIfUnused,
  updateAccountMeta,
  type AccountMetaPatch,
  type CreateAccountInput,
} from '@/lib/finance/accountOps'
import {
  createRecurring,
  deleteRecurring,
  generateDueOccurrences,
  recordRecurringNow,
  updateRecurring,
  type RecurringInput,
} from '@/lib/finance/recurringOps'
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from '@/lib/finance/transactionOps'
import { createTransfer, deleteTransfer } from '@/lib/finance/transferOps'
import { attachReceipt, removeReceipt } from '@/lib/finance/receiptOps'
import type {
  Account,
  Budget,
  Category,
  RecurringTransaction,
  Settings,
  Transaction,
  TransactionType,
  Transfer,
} from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

export interface TransactionFormInput {
  accountId: string
  categoryId: string
  type: TransactionType
  amountCents: number
  date: string
  merchant?: string
  description?: string
  notes?: string
  tags?: string[]
  location?: string
}

export interface TransferFormInput {
  fromAccountId: string
  toAccountId: string
  amountCents: number
  date: string
  description?: string
  isCreditCardPayment?: boolean
}

interface FinanceState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  transfers: Transfer[]
  recurring: RecurringTransaction[]
  budgets: Budget[]
  settings: Settings

  init: () => Promise<void>

  addAccount: (input: CreateAccountInput) => Promise<Account>
  updateAccount: (id: string, patch: AccountMetaPatch) => Promise<void>
  removeAccount: (id: string) => Promise<{ deleted: boolean; reason?: string }>

  addExpense: (input: TransactionFormInput) => Promise<Transaction>
  addIncome: (input: TransactionFormInput) => Promise<Transaction>
  editTransaction: (id: string, input: TransactionFormInput) => Promise<void>
  removeTransaction: (id: string) => Promise<void>
  duplicateTransaction: (id: string) => Promise<Transaction>
  attachReceiptToTransaction: (transactionId: string, file: File) => Promise<void>
  removeReceiptFromTransaction: (transactionId: string) => Promise<void>

  addTransfer: (input: TransferFormInput) => Promise<Transfer>
  removeTransfer: (id: string) => Promise<void>

  addCategory: (input: Omit<Category, 'id' | 'isDefault'>) => Promise<Category>
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => Promise<void>
  removeCategory: (id: string) => Promise<{ deleted: boolean; reason?: string }>

  addBudget: (input: Omit<Budget, 'id'>) => Promise<Budget>
  updateBudget: (id: string, patch: Partial<Omit<Budget, 'id'>>) => Promise<void>
  removeBudget: (id: string) => Promise<void>

  addRecurring: (input: RecurringInput) => Promise<RecurringTransaction>
  editRecurring: (
    id: string,
    patch: Partial<Omit<RecurringTransaction, 'id' | 'createdAt'>>,
  ) => Promise<void>
  removeRecurring: (id: string) => Promise<void>
  postRecurringNow: (id: string) => Promise<void>
  runDueRecurring: () => Promise<number>

  updateSettings: (patch: Partial<Settings>) => Promise<void>

  clearAllData: () => Promise<void>
  loadDemoData: () => Promise<void>
  replaceAllData: (data: {
    accounts: Account[]
    categories: Category[]
    transactions: Transaction[]
    transfers: Transfer[]
    recurring: RecurringTransaction[]
    budgets: Budget[]
    settings: Settings
  }) => Promise<void>
}

async function refetchAccount(id: string): Promise<Account | undefined> {
  return getFromStore('accounts', id)
}

function mergeAccount(accounts: Account[], updated: Account | undefined): Account[] {
  if (!updated) return accounts
  const index = accounts.findIndex((a) => a.id === updated.id)
  if (index === -1) return [...accounts, updated]
  const next = accounts.slice()
  next[index] = updated
  return next
}

let initPromise: Promise<void> | null = null

export const useFinanceStore = create<FinanceState>((set, get) => ({
  status: 'idle',
  error: null,
  accounts: [],
  categories: [],
  transactions: [],
  transfers: [],
  recurring: [],
  budgets: [],
  settings: DEFAULT_SETTINGS,

  async init() {
    // React 19 StrictMode (and some Suspense-related re-render paths) can invoke
    // this effect more than once. Without memoizing, a second, slower-resolving
    // call reads a stale snapshot of settings and then overwrites in-memory state
    // with it *after* a subsequent onboarding/settings write already landed -
    // losing that update from the UI's perspective. Sharing one in-flight promise
    // makes every caller observe the same, single, final result.
    if (initPromise) return initPromise
    initPromise = (async () => {
      set({ status: 'loading', error: null })
      try {
        let [accounts, categories, transactions, transfers, recurring, budgets, settingsRows] =
          await Promise.all([
            getAllFromStore('accounts'),
            getAllFromStore('categories'),
            getAllFromStore('transactions'),
            getAllFromStore('transfers'),
            getAllFromStore('recurring'),
            getAllFromStore('budgets'),
            getAllFromStore('settings'),
          ])

        if (categories.length === 0) {
          categories = getDefaultCategories()
          const db = await getDB()
          const tx = db.transaction('categories', 'readwrite')
          await Promise.all([...categories.map((c) => tx.store.put(c)), tx.done])
        }

        let settings = settingsRows[0]
        if (!settings) {
          settings = DEFAULT_SETTINGS
          await putInStore('settings', settings)
        }

        set({
          status: 'ready',
          accounts,
          categories,
          transactions,
          transfers,
          recurring,
          budgets,
          settings,
        })
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : 'Failed to load data' })
      }
    })()
    return initPromise
  },

  async addAccount(input) {
    const account = await createAccount(input)
    set((s) => ({ accounts: [...s.accounts, account] }))
    return account
  },

  async updateAccount(id, patch) {
    const updated = await updateAccountMeta(id, patch)
    set((s) => ({ accounts: mergeAccount(s.accounts, updated) }))
  },

  async removeAccount(id) {
    const result = await deleteAccountIfUnused(id)
    if (result.deleted) {
      set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }))
    }
    return result
  },

  async addExpense(input) {
    const transaction = await createTransaction({ ...input, type: 'expense' })
    const account = await refetchAccount(input.accountId)
    set((s) => ({
      transactions: [...s.transactions, transaction],
      accounts: mergeAccount(s.accounts, account),
    }))
    return transaction
  },

  async addIncome(input) {
    const transaction = await createTransaction({ ...input, type: 'income' })
    const account = await refetchAccount(input.accountId)
    set((s) => ({
      transactions: [...s.transactions, transaction],
      accounts: mergeAccount(s.accounts, account),
    }))
    return transaction
  },

  async editTransaction(id, input) {
    const existing = get().transactions.find((t) => t.id === id)
    const updated = await updateTransaction(id, input)
    const touchedAccountIds = new Set(
      [input.accountId, existing?.accountId].filter(Boolean) as string[],
    )
    const touchedAccounts = await Promise.all([...touchedAccountIds].map(refetchAccount))
    set((s) => {
      let accounts = s.accounts
      for (const acc of touchedAccounts) accounts = mergeAccount(accounts, acc)
      return {
        transactions: s.transactions.map((t) => (t.id === id ? updated : t)),
        accounts,
      }
    })
  },

  async removeTransaction(id) {
    const existing = get().transactions.find((t) => t.id === id)
    await deleteTransaction(id)
    const account = existing ? await refetchAccount(existing.accountId) : undefined
    set((s) => ({
      transactions: s.transactions.filter((t) => t.id !== id),
      accounts: mergeAccount(s.accounts, account),
    }))
  },

  async duplicateTransaction(id) {
    const existing = get().transactions.find((t) => t.id === id)
    if (!existing) throw new Error('Transaction not found')
    const input: TransactionFormInput = {
      accountId: existing.accountId,
      categoryId: existing.categoryId,
      type: existing.type,
      amountCents: existing.amountCents,
      date: todayISODate(),
      merchant: existing.merchant,
      description: existing.description,
      notes: existing.notes,
      tags: existing.tags,
      location: existing.location,
    }
    return existing.type === 'expense' ? get().addExpense(input) : get().addIncome(input)
  },

  async attachReceiptToTransaction(transactionId, file) {
    const receipt = await attachReceipt(transactionId, file)
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === transactionId ? { ...t, receiptId: receipt.id } : t,
      ),
    }))
  },

  async removeReceiptFromTransaction(transactionId) {
    await removeReceipt(transactionId)
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === transactionId ? { ...t, receiptId: null } : t,
      ),
    }))
  },

  async addTransfer(input) {
    const transfer = await createTransfer(input)
    const [fromAccount, toAccount] = await Promise.all([
      refetchAccount(input.fromAccountId),
      refetchAccount(input.toAccountId),
    ])
    set((s) => ({
      transfers: [...s.transfers, transfer],
      accounts: mergeAccount(mergeAccount(s.accounts, fromAccount), toAccount),
    }))
    return transfer
  },

  async removeTransfer(id) {
    const existing = get().transfers.find((t) => t.id === id)
    await deleteTransfer(id)
    if (existing) {
      const [fromAccount, toAccount] = await Promise.all([
        refetchAccount(existing.fromAccountId),
        refetchAccount(existing.toAccountId),
      ])
      set((s) => ({
        transfers: s.transfers.filter((t) => t.id !== id),
        accounts: mergeAccount(mergeAccount(s.accounts, fromAccount), toAccount),
      }))
    } else {
      set((s) => ({ transfers: s.transfers.filter((t) => t.id !== id) }))
    }
  },

  async addCategory(input) {
    const category: Category = { ...input, id: generateId('cat'), isDefault: false }
    await putInStore('categories', category)
    set((s) => ({ categories: [...s.categories, category] }))
    return category
  },

  async updateCategory(id, patch) {
    const existing = get().categories.find((c) => c.id === id)
    if (!existing) throw new Error('Category not found')
    const updated: Category = { ...existing, ...patch }
    await putInStore('categories', updated)
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? updated : c)) }))
  },

  async removeCategory(id) {
    const inUse =
      get().transactions.some((t) => t.categoryId === id) ||
      get().budgets.some((b) => b.categoryId === id) ||
      get().recurring.some((r) => r.categoryId === id)
    if (inUse) {
      return {
        deleted: false,
        reason: 'This category is used by existing transactions, budgets, or recurring items.',
      }
    }
    await deleteFromStore('categories', id)
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
    return { deleted: true }
  },

  async addBudget(input) {
    const budget: Budget = { ...input, id: generateId('budget') }
    await putInStore('budgets', budget)
    set((s) => ({ budgets: [...s.budgets, budget] }))
    return budget
  },

  async updateBudget(id, patch) {
    const existing = get().budgets.find((b) => b.id === id)
    if (!existing) throw new Error('Budget not found')
    const updated: Budget = { ...existing, ...patch }
    await putInStore('budgets', updated)
    set((s) => ({ budgets: s.budgets.map((b) => (b.id === id ? updated : b)) }))
  },

  async removeBudget(id) {
    await deleteFromStore('budgets', id)
    set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }))
  },

  async addRecurring(input) {
    const recurring = await createRecurring(input)
    set((s) => ({ recurring: [...s.recurring, recurring] }))
    return recurring
  },

  async editRecurring(id, patch) {
    const updated = await updateRecurring(id, patch)
    set((s) => ({ recurring: s.recurring.map((r) => (r.id === id ? updated : r)) }))
  },

  async removeRecurring(id) {
    await deleteRecurring(id)
    set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) }))
  },

  async postRecurringNow(id) {
    const transaction = await recordRecurringNow(id)
    const [account, recurringRows] = await Promise.all([
      refetchAccount(transaction.accountId),
      getAllFromStore('recurring'),
    ])
    set((s) => ({
      transactions: [...s.transactions, transaction],
      accounts: mergeAccount(s.accounts, account),
      recurring: recurringRows,
    }))
  },

  async runDueRecurring() {
    const count = await generateDueOccurrences()
    if (count > 0) {
      const [accounts, transactions, recurring] = await Promise.all([
        getAllFromStore('accounts'),
        getAllFromStore('transactions'),
        getAllFromStore('recurring'),
      ])
      set({ accounts, transactions, recurring })
    }
    return count
  },

  async updateSettings(patch) {
    const updated: Settings = { ...get().settings, ...patch }
    await putInStore('settings', updated)
    set({ settings: updated })
  },

  async clearAllData() {
    const db = await getDB()
    await Promise.all(
      (['accounts', 'transactions', 'transfers', 'recurring', 'budgets', 'receipts'] as const).map(
        (store) => db.clear(store),
      ),
    )
    const categories = getDefaultCategories()
    await db.clear('categories')
    const tx = db.transaction('categories', 'readwrite')
    await Promise.all([...categories.map((c) => tx.store.put(c)), tx.done])
    set({
      accounts: [],
      transactions: [],
      transfers: [],
      recurring: [],
      budgets: [],
      categories,
    })
  },

  async loadDemoData() {
    await seedDemoDataIntoDB()
    const [accounts, categories, transactions, transfers, recurring, budgets] = await Promise.all([
      getAllFromStore('accounts'),
      getAllFromStore('categories'),
      getAllFromStore('transactions'),
      getAllFromStore('transfers'),
      getAllFromStore('recurring'),
      getAllFromStore('budgets'),
    ])
    set({ accounts, categories, transactions, transfers, recurring, budgets })
  },

  async replaceAllData(data) {
    const db = await getDB()
    await Promise.all(
      (
        ['accounts', 'categories', 'transactions', 'transfers', 'recurring', 'budgets'] as const
      ).map((store) => db.clear(store)),
    )
    const tx = db.transaction(
      ['accounts', 'categories', 'transactions', 'transfers', 'recurring', 'budgets', 'settings'],
      'readwrite',
    )
    await Promise.all([
      ...data.accounts.map((a) => tx.objectStore('accounts').put(a)),
      ...data.categories.map((c) => tx.objectStore('categories').put(c)),
      ...data.transactions.map((t) => tx.objectStore('transactions').put(t)),
      ...data.transfers.map((t) => tx.objectStore('transfers').put(t)),
      ...data.recurring.map((r) => tx.objectStore('recurring').put(r)),
      ...data.budgets.map((b) => tx.objectStore('budgets').put(b)),
      tx.objectStore('settings').put(data.settings),
      tx.done,
    ])
    set({
      accounts: data.accounts,
      categories: data.categories,
      transactions: data.transactions,
      transfers: data.transfers,
      recurring: data.recurring,
      budgets: data.budgets,
      settings: data.settings,
    })
  },
}))
