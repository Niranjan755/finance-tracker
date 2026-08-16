import { Copy } from 'lucide-react'
import { getIcon } from '@/lib/icons'
import { formatDisplayDate } from '@/lib/date'
import { MoneyText } from '@/components/finance/MoneyText'
import type { Account, Category, Transaction } from '@/types'

interface TransactionRowProps {
  transaction: Transaction
  category: Category | undefined
  account: Account | undefined
  onClick?: () => void
  showAccount?: boolean
}

export function TransactionRow({
  transaction,
  category,
  account,
  onClick,
  showAccount = true,
}: TransactionRowProps) {
  const Icon = getIcon(category?.icon ?? 'circle-dashed')

  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: `${category?.color ?? '#6b7280'}1a`,
          color: category?.color ?? '#6b7280',
        }}
      >
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{transaction.merchant || category?.name || 'Transaction'}</span>
          {transaction.possibleDuplicateOfId && (
            <Copy
              className="text-amber-600 dark:text-amber-400 size-3.5 shrink-0"
              aria-label="Possible duplicate"
            />
          )}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {category?.name}
          {showAccount && account ? ` · ${account.name}` : ''} ·{' '}
          {formatDisplayDate(transaction.date)}
        </p>
      </div>
      <MoneyText
        cents={transaction.amountCents}
        kind={transaction.type}
        currency={account?.currency}
        className="shrink-0 text-sm font-medium"
      />
    </button>
  )
}
