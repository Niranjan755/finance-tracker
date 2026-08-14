import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Landmark, Receipt, Search, Tag } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { useFinanceStore } from '@/store/financeStore'
import { useUIStore } from '@/store/uiStore'
import { formatSignedCurrency } from '@/lib/money'
import { formatDisplayDate } from '@/lib/date'

export function GlobalSearch() {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const accounts = useFinanceStore((s) => s.accounts)
  const categories = useFinanceStore((s) => s.categories)
  const transactions = useFinanceStore((s) => s.transactions)
  const settings = useFinanceStore((s) => s.settings)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!open)
      } else if (e.key.toLowerCase() === 'n' && !open && !isTypingTarget(e.target)) {
        e.preventDefault()
        useUIStore.getState().openAddTransaction('expense')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const q = query.trim().toLowerCase()
  const matchedAccounts = q ? accounts.filter((a) => a.name.toLowerCase().includes(q)) : []
  const matchedCategories = q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : []
  const matchedTransactions = q
    ? transactions
        .filter(
          (t) =>
            t.merchant.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.notes.toLowerCase().includes(q) ||
            String(t.amountCents / 100).includes(q),
        )
        .slice(0, 8)
    : []

  return (
    <>
      <Button
        variant="outline"
        className="hidden w-64 justify-start gap-2 text-muted-foreground sm:flex"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" aria-hidden="true" />
        Search...
        <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Search" onClick={() => setOpen(true)}>
        <Search className="size-4.5" aria-hidden="true" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search transactions, accounts, and categories"
      >
        <CommandInput
          placeholder="Search transactions, accounts, categories..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {q && matchedAccounts.length === 0 && matchedCategories.length === 0 && matchedTransactions.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {!q && <CommandEmpty>Type to search transactions, accounts, or categories.</CommandEmpty>}

          {matchedAccounts.length > 0 && (
            <CommandGroup heading="Accounts">
              {matchedAccounts.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`account-${a.id}`}
                  onSelect={() => {
                    setOpen(false)
                    navigate(`/accounts/${a.id}`)
                  }}
                >
                  <Landmark className="size-4" aria-hidden="true" />
                  {a.name}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatSignedCurrency(a.balanceCents, 'neutral', a.currency)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {matchedCategories.length > 0 && (
            <CommandGroup heading="Categories">
              {matchedCategories.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`category-${c.id}`}
                  onSelect={() => {
                    setOpen(false)
                    navigate(`/transactions?category=${c.id}`)
                  }}
                >
                  <Tag className="size-4" aria-hidden="true" />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {matchedTransactions.length > 0 && (
            <CommandGroup heading="Transactions">
              {matchedTransactions.map((t) => {
                const account = accountById.get(t.accountId)
                const category = categoryById.get(t.categoryId)
                return (
                  <CommandItem
                    key={t.id}
                    value={`transaction-${t.id}`}
                    onSelect={() => {
                      setOpen(false)
                      navigate(`/transactions?highlight=${t.id}`)
                    }}
                  >
                    <Receipt className="size-4" aria-hidden="true" />
                    <span className="flex-1 truncate">
                      {t.merchant || category?.name || 'Transaction'}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDisplayDate(t.date)} · {account?.name}
                      </span>
                    </span>
                    <span className="ml-auto text-xs font-medium">
                      {formatSignedCurrency(t.amountCents, t.type, settings.currency)}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}
