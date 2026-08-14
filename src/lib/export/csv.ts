import Papa from 'papaparse'
import { fromCents } from '@/lib/money'
import { downloadBlob } from './download'
import type { Account, Category, Transaction, Transfer } from '@/types'

export interface TransactionExportRow {
  Date: string
  Type: string
  Merchant: string
  Category: string
  Account: string
  Amount: number
  Notes: string
  Tags: string
}

export function buildTransactionExportRows(
  transactions: Transaction[],
  transfers: Transfer[],
  accounts: Account[],
  categories: Category[],
): TransactionExportRow[] {
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const rows: TransactionExportRow[] = []

  for (const t of transactions) {
    rows.push({
      Date: t.date,
      Type: t.type === 'expense' ? 'Expense' : 'Income',
      Merchant: t.merchant,
      Category: categoryById.get(t.categoryId)?.name ?? '',
      Account: accountById.get(t.accountId)?.name ?? '',
      Amount: t.type === 'expense' ? -fromCents(t.amountCents) : fromCents(t.amountCents),
      Notes: t.notes,
      Tags: t.tags.join(', '),
    })
  }

  for (const t of transfers) {
    rows.push({
      Date: t.date,
      Type: 'Transfer',
      Merchant: t.description || 'Transfer',
      Category: '',
      Account: `${accountById.get(t.fromAccountId)?.name ?? '?'} -> ${accountById.get(t.toAccountId)?.name ?? '?'}`,
      Amount: fromCents(t.fromAmountCents),
      Notes: '',
      Tags: '',
    })
  }

  return rows.sort((a, b) => a.Date.localeCompare(b.Date))
}

export function exportTransactionsToCSV(
  transactions: Transaction[],
  transfers: Transfer[],
  accounts: Account[],
  categories: Category[],
  filename: string,
): void {
  const rows = buildTransactionExportRows(transactions, transfers, accounts, categories)
  const csv = Papa.unparse(rows)
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
}
