import writeXlsxFile from 'write-excel-file/browser'
import { buildTransactionExportRows, type TransactionExportRow } from './csv'
import type { Account, Category, Transaction, Transfer } from '@/types'

export async function exportTransactionsToExcel(
  transactions: Transaction[],
  transfers: Transfer[],
  accounts: Account[],
  categories: Category[],
  filename: string,
): Promise<void> {
  const rows = buildTransactionExportRows(transactions, transfers, accounts, categories)

  await writeXlsxFile<TransactionExportRow>(rows, {
    columns: [
      { header: 'Date', cell: (r) => r.Date, width: 12 },
      { header: 'Type', cell: (r) => r.Type, width: 10 },
      { header: 'Merchant', cell: (r) => r.Merchant, width: 24 },
      { header: 'Category', cell: (r) => r.Category, width: 18 },
      { header: 'Account', cell: (r) => r.Account, width: 20 },
      { header: 'Amount', cell: (r) => r.Amount, width: 12 },
      { header: 'Notes', cell: (r) => r.Notes, width: 24 },
      { header: 'Tags', cell: (r) => r.Tags, width: 16 },
    ],
    sheet: 'Transactions',
  }).toFile(filename)
}
