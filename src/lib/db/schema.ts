import type { DBSchema } from 'idb'
import type {
  Account,
  Budget,
  Category,
  Receipt,
  RecurringTransaction,
  Settings,
  Transaction,
  Transfer,
} from '@/types'

export const DB_NAME = 'finance-tracker'
export const DB_VERSION = 2

export interface FinanceDB extends DBSchema {
  accounts: {
    key: string
    value: Account
  }
  categories: {
    key: string
    value: Category
    indexes: { 'by-type': string }
  }
  transactions: {
    key: string
    value: Transaction
    indexes: {
      'by-date': string
      'by-account': string
      'by-category': string
      'by-type': string
      'by-recurring': string
    }
  }
  transfers: {
    key: string
    value: Transfer
    indexes: { 'by-date': string; 'by-fromAccount': string; 'by-toAccount': string }
  }
  recurring: {
    key: string
    value: RecurringTransaction
    indexes: { 'by-nextRunDate': string }
  }
  budgets: {
    key: string
    value: Budget
    indexes: { 'by-category': string; 'by-period': [number, number] }
  }
  receipts: {
    key: string
    value: Receipt
    indexes: { 'by-transaction': string }
  }
  settings: {
    key: string
    value: Settings
  }
}

export const STORE_NAMES = [
  'accounts',
  'categories',
  'transactions',
  'transfers',
  'recurring',
  'budgets',
  'receipts',
  'settings',
] as const
