import { openDB, type IDBPDatabase } from 'idb'
import { DB_NAME, DB_VERSION, type FinanceDB } from './schema'

let dbPromise: Promise<IDBPDatabase<FinanceDB>> | null = null

export function getDB(): Promise<IDBPDatabase<FinanceDB>> {
  dbPromise ??= openDB<FinanceDB>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('categories')) {
        const store = db.createObjectStore('categories', { keyPath: 'id' })
        store.createIndex('by-type', 'type')
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-account', 'accountId')
        store.createIndex('by-category', 'categoryId')
        store.createIndex('by-type', 'type')
        store.createIndex('by-recurring', 'recurringId')
      }
      if (!db.objectStoreNames.contains('transfers')) {
        const store = db.createObjectStore('transfers', { keyPath: 'id' })
        store.createIndex('by-date', 'date')
        store.createIndex('by-fromAccount', 'fromAccountId')
        store.createIndex('by-toAccount', 'toAccountId')
      }
      if (!db.objectStoreNames.contains('recurring')) {
        const store = db.createObjectStore('recurring', { keyPath: 'id' })
        store.createIndex('by-nextRunDate', 'nextRunDate')
      }
      if (!db.objectStoreNames.contains('budgets')) {
        const store = db.createObjectStore('budgets', { keyPath: 'id' })
        store.createIndex('by-category', 'categoryId')
        store.createIndex('by-period', ['year', 'month'])
      }
      if (!db.objectStoreNames.contains('receipts')) {
        const store = db.createObjectStore('receipts', { keyPath: 'id' })
        store.createIndex('by-transaction', 'transactionId')
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' })
      }

      // Migration from v1 to v2: Update transfer schema to support multi-currency
      if (oldVersion < 2 && db.objectStoreNames.contains('transfers')) {
        const transfersStore = tx.objectStore('transfers')
        const allTransfers = await transfersStore.getAll()
        
        for (const oldTransfer of allTransfers) {
          const transfer = oldTransfer as any
          // Check if this is an old-format transfer (has amountCents but not fromAmountCents)
          if ('amountCents' in transfer && !('fromAmountCents' in transfer)) {
            const migratedTransfer = {
              ...transfer,
              fromAmountCents: transfer.amountCents,
              toAmountCents: transfer.amountCents,
              exchangeRate: 1,
            }
            delete migratedTransfer.amountCents
            await transfersStore.put(migratedTransfer)
          }
        }
      }
    },
  })
  return dbPromise
}



/** Test-only: closes the current connection so a subsequent deleteDatabase() doesn't block. */
export async function closeDBConnection(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
}
