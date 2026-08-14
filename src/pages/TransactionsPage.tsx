import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUpDown, Receipt, Search, SlidersHorizontal, X, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/finance/PageHeader'
import { EmptyState } from '@/components/finance/EmptyState'
import { MoneyText } from '@/components/finance/MoneyText'
import { AddTransactionMenu } from '@/components/finance/AddTransactionMenu'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { TransactionDetailSheet } from '@/features/transactions/TransactionDetailSheet'
import { TransferDetailSheet } from '@/features/transactions/TransferDetailSheet'
import { useFinanceStore } from '@/store/financeStore'
import { getIcon } from '@/lib/icons'
import { formatDisplayDate } from '@/lib/date'
import { toCents } from '@/lib/money'
import type { Currency, Transaction, Transfer } from '@/types'

type Row =
  | {
      id: string
      kind: 'transaction'
      date: string
      amountCents: number
      createdAt: string
      transaction: Transaction
    }
  | {
      id: string
      kind: 'transfer'
      date: string
      amountCents: number
      createdAt: string
      transfer: Transfer
    }

interface Filters {
  search: string
  type: 'all' | 'expense' | 'income' | 'transfer'
  accountId: string
  categoryId: string
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
  tag: string
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  type: 'all',
  accountId: 'all',
  categoryId: 'all',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
  tag: 'all',
}

const PAGE_SIZE = 50

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const accounts = useFinanceStore((s) => s.accounts)
  const categories = useFinanceStore((s) => s.categories)
  const transactions = useFinanceStore((s) => s.transactions)
  const transfers = useFinanceStore((s) => s.transfers)

  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    categoryId: searchParams.get('category') ?? 'all',
  }))
  const [sortKey, setSortKey] = useState<'date' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null)

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const allTags = useMemo(
    () => [...new Set(transactions.flatMap((t) => t.tags))].sort(),
    [transactions],
  )

  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (!highlightId) return
    const txn = transactions.find((t) => t.id === highlightId)
    if (txn) {
      setSelectedTransaction(txn)
    } else {
      const xfer = transfers.find((t) => t.id === highlightId)
      if (xfer) setSelectedTransfer(xfer)
    }
    const next = new URLSearchParams(searchParams)
    next.delete('highlight')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allRows = useMemo<Row[]>(() => {
    const txnRows: Row[] = transactions.map((t) => ({
      id: t.id,
      kind: 'transaction',
      date: t.date,
      amountCents: t.amountCents,
      createdAt: t.createdAt,
      transaction: t,
    }))
    const xferRows: Row[] = transfers.map((t) => ({
      id: t.id,
      kind: 'transfer',
      date: t.date,
      amountCents: t.fromAmountCents,
      createdAt: t.createdAt,
      transfer: t,
    }))
    return [...txnRows, ...xferRows]
  }, [transactions, transfers])

  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const minCents = filters.amountMin ? toCents(filters.amountMin) : null
    const maxCents = filters.amountMax ? toCents(filters.amountMax) : null

    return allRows.filter((row) => {
      if (filters.type !== 'all') {
        if (filters.type === 'transfer' && row.kind !== 'transfer') return false
        if (
          filters.type !== 'transfer' &&
          (row.kind !== 'transaction' || row.transaction.type !== filters.type)
        )
          return false
      }
      if (filters.accountId !== 'all') {
        if (row.kind === 'transaction' && row.transaction.accountId !== filters.accountId)
          return false
        if (
          row.kind === 'transfer' &&
          row.transfer.fromAccountId !== filters.accountId &&
          row.transfer.toAccountId !== filters.accountId
        )
          return false
      }
      if (filters.categoryId !== 'all') {
        if (row.kind === 'transfer') return false
        if (row.transaction.categoryId !== filters.categoryId) return false
      }
      if (filters.tag !== 'all') {
        if (row.kind === 'transfer' || !row.transaction.tags.includes(filters.tag)) return false
      }
      if (filters.dateFrom && row.date < filters.dateFrom) return false
      if (filters.dateTo && row.date > filters.dateTo) return false
      if (minCents !== null && row.amountCents < minCents) return false
      if (maxCents !== null && row.amountCents > maxCents) return false
      if (q) {
        const haystack =
          row.kind === 'transaction'
            ? `${row.transaction.merchant} ${row.transaction.description} ${row.transaction.notes} ${row.transaction.tags.join(' ')} ${(row.transaction.amountCents / 100).toFixed(2)}`
            : `${row.transfer.description} transfer ${(row.transfer.fromAmountCents / 100).toFixed(2)} ${(row.transfer.toAmountCents / 100).toFixed(2)}`
        if (!haystack.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allRows, filters])

  const sortedRows = useMemo(() => {
    const sorted = filteredRows.slice().sort((a, b) => {
      const primary =
        sortKey === 'date' ? a.date.localeCompare(b.date) : a.amountCents - b.amountCents
      const result = primary !== 0 ? primary : a.createdAt.localeCompare(b.createdAt)
      return sortDir === 'asc' ? result : -result
    })
    return sorted
  }, [filteredRows, sortKey, sortDir])

  const visibleRows = sortedRows.slice(0, visibleCount)
  const activeFilterCount = Object.entries(filters).filter(
    ([key, v]) => key !== 'search' && v && v !== 'all',
  ).length

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }))
    setVisibleCount(PAGE_SIZE)
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS)
    setVisibleCount(PAGE_SIZE)
  }

  function toggleSort(key: 'date' | 'amount') {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        description={`${sortedRows.length} transaction${sortedRows.length === 1 ? '' : 's'}`}
        actions={<AddTransactionMenu />}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            placeholder="Search transactions..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            aria-label="Search transactions"
          />
        </div>
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" className="gap-1.5">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <PopoverContent align="end" className="w-80 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={filters.type}
                onValueChange={(v) => updateFilter('type', (v ?? 'all') as Filters['type'])}
                items={{
                  all: 'All Types',
                  expense: 'Expense',
                  income: 'Income',
                  transfer: 'Transfer',
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.accountId}
                onValueChange={(v) => updateFilter('accountId', v ?? 'all')}
                items={{
                  all: 'All Accounts',
                  ...Object.fromEntries(accounts.map((a) => [a.id, a.name])),
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select
              value={filters.categoryId}
              onValueChange={(v) => updateFilter('categoryId', v ?? 'all')}
              items={{
                all: 'All Categories',
                ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.parentId ? `  ${c.name}` : c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allTags.length > 0 && (
              <Select
                value={filters.tag}
                onValueChange={(v) => updateFilter('tag', v ?? 'all')}
                items={{ all: 'All Tags', ...Object.fromEntries(allTags.map((t) => [t, `#${t}`])) }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map((t) => (
                    <SelectItem key={t} value={t}>
                      #{t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                aria-label="From date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
              />
              <Input
                type="date"
                aria-label="To date"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Min amount"
                inputMode="decimal"
                value={filters.amountMin}
                onChange={(e) => updateFilter('amountMin', e.target.value)}
              />
              <Input
                placeholder="Max amount"
                inputMode="decimal"
                value={filters.amountMax}
                onChange={(e) => updateFilter('amountMax', e.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" className="w-full gap-1.5" onClick={clearFilters}>
              <X className="size-3.5" aria-hidden="true" />
              Clear Filters
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {sortedRows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={
            transactions.length === 0 && transfers.length === 0
              ? 'No transactions yet'
              : 'No matching transactions'
          }
          description={
            transactions.length === 0 && transfers.length === 0
              ? 'Start tracking your finances by adding your first transaction.'
              : 'Try adjusting your search or filters.'
          }
          action={
            transactions.length === 0 && transfers.length === 0 ? (
              <AddTransactionMenu />
            ) : (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )
          }
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden p-0 sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort('date')}
                      className="hover:text-foreground flex items-center gap-1"
                    >
                      Date <ArrowUpDown className="size-3" aria-hidden="true" />
                    </button>
                  </TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('amount')}
                      className="hover:text-foreground ml-auto flex items-center gap-1"
                    >
                      Amount <ArrowUpDown className="size-3" aria-hidden="true" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() =>
                      row.kind === 'transaction'
                        ? setSelectedTransaction(row.transaction)
                        : setSelectedTransfer(row.transfer)
                    }
                  >
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDisplayDate(row.date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.kind === 'transaction'
                        ? row.transaction.merchant ||
                          categoryById.get(row.transaction.categoryId)?.name ||
                          'Transaction'
                        : row.transfer.description || 'Transfer'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.kind === 'transaction'
                        ? categoryById.get(row.transaction.categoryId)?.name
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.kind === 'transaction'
                        ? accountById.get(row.transaction.accountId)?.name
                        : `${accountById.get(row.transfer.fromAccountId)?.name ?? '?'} → ${accountById.get(row.transfer.toAccountId)?.name ?? '?'}`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.kind === 'transfer'
                            ? 'outline'
                            : row.transaction.type === 'income'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {row.kind === 'transfer'
                          ? 'Transfer'
                          : row.transaction.type === 'income'
                            ? 'Income'
                            : 'Expense'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyText
                        cents={row.amountCents}
                        kind={row.kind === 'transfer' ? 'neutral' : row.transaction.type}
                        currency={
                          row.kind === 'transaction'
                            ? accountById.get(row.transaction.accountId)?.currency
                            : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="divide-y p-1 sm:hidden">
            {visibleRows.map((row) =>
              row.kind === 'transaction' ? (
                <MobileRow
                  key={row.id}
                  icon={getIcon(
                    categoryById.get(row.transaction.categoryId)?.icon ?? 'circle-dashed',
                  )}
                  color={categoryById.get(row.transaction.categoryId)?.color}
                  title={
                    row.transaction.merchant ||
                    categoryById.get(row.transaction.categoryId)?.name ||
                    'Transaction'
                  }
                  subtitle={`${categoryById.get(row.transaction.categoryId)?.name ?? ''} · ${formatDisplayDate(row.date)}`}
                  amountCents={row.amountCents}
                  kind={row.transaction.type}
                  currency={accountById.get(row.transaction.accountId)?.currency}
                  onClick={() => setSelectedTransaction(row.transaction)}
                />
              ) : (
                <MobileRow
                  key={row.id}
                  icon={getIcon('rotate-ccw')}
                  title={row.transfer.description || 'Transfer'}
                  subtitle={`${accountById.get(row.transfer.fromAccountId)?.name ?? '?'} → ${accountById.get(row.transfer.toAccountId)?.name ?? '?'} · ${formatDisplayDate(row.date)}`}
                  amountCents={row.amountCents}
                  kind="neutral"
                  onClick={() => setSelectedTransfer(row.transfer)}
                />
              ),
            )}
          </Card>

          {visibleCount < sortedRows.length && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Load More ({sortedRows.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      <TransactionDetailSheet
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
      <TransferDetailSheet transfer={selectedTransfer} onClose={() => setSelectedTransfer(null)} />
    </div>
  )
}

function MobileRow({
  icon: Icon,
  color,
  title,
  subtitle,
  amountCents,
  kind,
  currency,
  onClick,
}: {
  icon: LucideIcon
  color?: string
  title: string
  subtitle: string
  amountCents: number
  kind: 'expense' | 'income' | 'neutral'
  currency?: Currency
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left"
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color ?? '#6b7280'}1a`, color: color ?? '#6b7280' }}
      >
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
      </div>
      <MoneyText
        cents={amountCents}
        kind={kind}
        currency={currency}
        className="shrink-0 text-sm font-medium"
      />
    </button>
  )
}
