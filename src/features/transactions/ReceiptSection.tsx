import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Paperclip, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getReceipt } from '@/lib/finance/receiptOps'
import { useFinanceStore } from '@/store/financeStore'
import type { Receipt } from '@/types'

interface ReceiptSectionProps {
  transactionId: string
}

export function ReceiptSection({ transactionId }: ReceiptSectionProps) {
  // Read live from the store (not a prop snapshot) so attach/remove reflect immediately.
  const receiptId = useFinanceStore(
    (s) => s.transactions.find((t) => t.id === transactionId)?.receiptId ?? null,
  )
  const attachReceiptToTransaction = useFinanceStore((s) => s.attachReceiptToTransaction)
  const removeReceiptFromTransaction = useFinanceStore((s) => s.removeReceiptFromTransaction)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    if (!receiptId) {
      setReceipt(null)
      return
    }
    getReceipt(receiptId).then((r) => {
      if (!cancelled && r) setReceipt(r)
    })
    return () => {
      cancelled = true
    }
  }, [receiptId])

  useEffect(() => {
    if (!receipt) {
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(receipt.blob)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [receipt])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      await attachReceiptToTransaction(transactionId, file)
      toast.success('Receipt attached')
    } catch (err) {
      toast.error('Unable to attach receipt', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    await removeReceiptFromTransaction(transactionId)
    toast.success('Receipt removed')
  }

  return (
    <div className="border-t pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="size-3.5" aria-hidden="true" />
          Receipt
        </p>
        {receipt && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive h-auto gap-1 p-1"
            onClick={handleRemove}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Remove
          </Button>
        )}
      </div>

      {receipt && objectUrl ? (
        receipt.mimeType === 'application/pdf' ? (
          <a
            href={objectUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:bg-accent flex items-center gap-2 rounded-lg border p-3 text-sm"
          >
            <FileText className="text-muted-foreground size-5" aria-hidden="true" />
            {receipt.fileName}
          </a>
        ) : (
          <a href={objectUrl} target="_blank" rel="noreferrer">
            <img
              src={objectUrl}
              alt={`Receipt: ${receipt.fileName}`}
              className="max-h-48 rounded-lg border object-contain"
            />
          </a>
        )
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="size-3.5" aria-hidden="true" />
            {uploading ? 'Uploading...' : 'Add Receipt'}
          </Button>
        </div>
      )}
    </div>
  )
}
