import { getDB } from '@/lib/db/client'
import { generateId } from '@/lib/id'
import type { Receipt } from '@/types'

export const ACCEPTED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export function validateReceiptFile(file: File): string | null {
  if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) {
    return 'Only JPG, PNG, WebP, and PDF files are supported.'
  }
  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    return 'File is too large. Maximum size is 10MB.'
  }
  return null
}

export async function attachReceipt(transactionId: string, file: File): Promise<Receipt> {
  const error = validateReceiptFile(file)
  if (error) throw new Error(error)

  const db = await getDB()
  const tx = db.transaction(['receipts', 'transactions'], 'readwrite')
  const transaction = await tx.objectStore('transactions').get(transactionId)
  if (!transaction) throw new Error('Transaction not found')

  // Replace any existing receipt on this transaction.
  if (transaction.receiptId) {
    await tx.objectStore('receipts').delete(transaction.receiptId)
  }

  const receipt: Receipt = {
    id: generateId('receipt'),
    transactionId,
    fileName: file.name,
    mimeType: file.type,
    blob: file,
    createdAt: new Date().toISOString(),
  }

  await Promise.all([
    tx.objectStore('receipts').put(receipt),
    tx
      .objectStore('transactions')
      .put({ ...transaction, receiptId: receipt.id, updatedAt: new Date().toISOString() }),
    tx.done,
  ])

  return receipt
}

export async function removeReceipt(transactionId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['receipts', 'transactions'], 'readwrite')
  const transaction = await tx.objectStore('transactions').get(transactionId)
  if (!transaction?.receiptId) return

  await Promise.all([
    tx.objectStore('receipts').delete(transaction.receiptId),
    tx
      .objectStore('transactions')
      .put({ ...transaction, receiptId: null, updatedAt: new Date().toISOString() }),
    tx.done,
  ])
}

export async function getReceipt(receiptId: string): Promise<Receipt | undefined> {
  const db = await getDB()
  return db.get('receipts', receiptId)
}
