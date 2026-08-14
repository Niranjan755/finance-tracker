import { z } from 'zod'
import { downloadBlob } from './download'
import type {
  Account,
  Budget,
  Category,
  RecurringTransaction,
  Settings,
  Transaction,
  Transfer,
} from '@/types'

export interface BackupData {
  version: number
  exportedAt: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  transfers: Transfer[]
  recurring: RecurringTransaction[]
  budgets: Budget[]
  settings: Settings
}

export function buildBackup(data: Omit<BackupData, 'version' | 'exportedAt'>): BackupData {
  return { version: 1, exportedAt: new Date().toISOString(), ...data }
}

export function downloadBackupJSON(backup: BackupData, filename: string): void {
  const json = JSON.stringify(backup, null, 2)
  downloadBlob(new Blob([json], { type: 'application/json' }), filename)
}

const backupSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  accounts: z.array(z.record(z.string(), z.unknown())),
  categories: z.array(z.record(z.string(), z.unknown())),
  transactions: z.array(z.record(z.string(), z.unknown())),
  transfers: z.array(z.record(z.string(), z.unknown())),
  recurring: z.array(z.record(z.string(), z.unknown())),
  budgets: z.array(z.record(z.string(), z.unknown())),
  settings: z.record(z.string(), z.unknown()),
})

export function parseBackupJSON(text: string): BackupData {
  const raw: unknown = JSON.parse(text)
  const parsed = backupSchema.parse(raw)
  return parsed as unknown as BackupData
}
