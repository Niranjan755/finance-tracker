import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  parseCSVFile,
  validateImportRows,
  type ColumnMapping,
  type ParsedCSV,
} from '@/lib/import/csvImport'
import { useFinanceStore } from '@/store/financeStore'
import { formatDisplayDate } from '@/lib/date'
import { formatSignedCurrency } from '@/lib/money'

interface CSVImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMPTY_MAPPING: ColumnMapping = {
  date: null,
  merchant: null,
  amount: null,
  category: null,
  account: null,
}

export function CSVImportDialog({ open, onOpenChange }: CSVImportDialogProps) {
  const accounts = useFinanceStore((s) => s.accounts)
  const categories = useFinanceStore((s) => s.categories)
  const addExpense = useFinanceStore((s) => s.addExpense)
  const addIncome = useFinanceStore((s) => s.addIncome)

  const [parsed, setParsed] = useState<ParsedCSV | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING)
  const [defaultAccountId, setDefaultAccountId] = useState(accounts[0]?.id ?? '')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    if (!parsed) return []
    return validateImportRows(parsed, mapping, accounts, categories, defaultAccountId)
  }, [parsed, mapping, accounts, categories, defaultAccountId])

  const validCount = results.filter((r) => r.valid).length
  const invalidCount = results.length - validCount

  function reset() {
    setParsed(null)
    setMapping(EMPTY_MAPPING)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const result = await parseCSVFile(file)
      if (result.rows.length === 0) {
        toast.error('That CSV file has no data rows')
        return
      }
      setParsed(result)
      // Best-effort auto-mapping by common header names.
      const guess = (names: string[]) =>
        result.headers.find((h) => names.includes(h.trim().toLowerCase())) ?? null
      setMapping({
        date: guess(['date', 'transaction date']),
        merchant: guess(['description', 'merchant', 'payee', 'name']),
        amount: guess(['amount', 'value']),
        category: guess(['category']),
        account: guess(['account']),
      })
    } catch {
      toast.error('Unable to read that CSV file')
    }
  }

  async function handleImport() {
    setImporting(true)
    let imported = 0
    try {
      for (const row of results) {
        if (
          !row.valid ||
          !row.accountId ||
          !row.categoryId ||
          !row.type ||
          !row.amountCents ||
          !row.date
        )
          continue
        const input = {
          accountId: row.accountId,
          categoryId: row.categoryId,
          type: row.type,
          amountCents: row.amountCents,
          date: row.date,
          merchant: row.merchant ?? '',
        }
        if (row.type === 'expense') await addExpense(input)
        else await addIncome(input)
        imported += 1
      }
      toast.success(`Imported ${imported} transaction${imported === 1 ? '' : 's'}`)
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error('Import failed partway through', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
        </DialogHeader>

        {!parsed ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
            <Upload className="text-muted-foreground size-8" aria-hidden="true" />
            <p className="text-muted-foreground text-sm">
              Upload a CSV file exported from your bank or another app.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button onClick={() => fileInputRef.current?.click()}>Choose File</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Map Columns</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MappingSelect
                  label="Date *"
                  headers={parsed.headers}
                  value={mapping.date}
                  onChange={(v) => setMapping((m) => ({ ...m, date: v }))}
                />
                <MappingSelect
                  label="Amount *"
                  headers={parsed.headers}
                  value={mapping.amount}
                  onChange={(v) => setMapping((m) => ({ ...m, amount: v }))}
                />
                <MappingSelect
                  label="Merchant"
                  headers={parsed.headers}
                  value={mapping.merchant}
                  onChange={(v) => setMapping((m) => ({ ...m, merchant: v }))}
                />
                <MappingSelect
                  label="Category"
                  headers={parsed.headers}
                  value={mapping.category}
                  onChange={(v) => setMapping((m) => ({ ...m, category: v }))}
                />
                <MappingSelect
                  label="Account"
                  headers={parsed.headers}
                  value={mapping.account}
                  onChange={(v) => setMapping((m) => ({ ...m, account: v }))}
                />
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Default Account</p>
                  <Select
                    value={defaultAccountId}
                    onValueChange={(v) => setDefaultAccountId(v ?? '')}
                    items={Object.fromEntries(accounts.map((a) => [a.id, a.name]))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                Negative amounts import as expenses; positive amounts import as income. Amounts
                without a matching category fall back to "Other".
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Badge variant="secondary">{validCount} valid</Badge>
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalid</Badge>}
              <span className="text-muted-foreground">{parsed.rows.length} rows total</span>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.slice(0, 200).map((r) => (
                    <TableRow key={r.rowIndex}>
                      <TableCell>{r.rowIndex + 1}</TableCell>
                      <TableCell>{r.date ? formatDisplayDate(r.date) : '-'}</TableCell>
                      <TableCell>{r.merchant || '-'}</TableCell>
                      <TableCell>
                        {r.amountCents != null && r.type
                          ? formatSignedCurrency(r.amountCents, r.type)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {r.valid ? (
                          <Badge variant="secondary">Valid</Badge>
                        ) : (
                          <span className="text-destructive text-xs">{r.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Choose Different File
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0 || importing}>
                {importing
                  ? 'Importing...'
                  : `Import ${validCount} Transaction${validCount === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MappingSelect({
  label,
  headers,
  value,
  onChange,
}: {
  label: string
  headers: string[]
  value: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      <Select
        value={value ?? 'none'}
        onValueChange={(v) => onChange(v === 'none' ? null : v)}
        items={{ none: 'None', ...Object.fromEntries(headers.map((h) => [h, h])) }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {headers.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
