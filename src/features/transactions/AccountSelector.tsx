import { getIcon } from '@/lib/icons'
import { formatCurrency } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Account } from '@/types'

interface AccountSelectorProps {
  accounts: Account[]
  value: string
  onChange: (accountId: string) => void
  label: string
  excludeAccountId?: string
}

export function AccountSelector({
  accounts,
  value,
  onChange,
  label,
  excludeAccountId,
}: AccountSelectorProps) {
  const options = accounts.filter((a) => a.isActive && a.id !== excludeAccountId)

  return (
    <div role="radiogroup" aria-label={label} className="space-y-1.5">
      {options.map((account) => {
        const Icon = getIcon(account.icon)
        const isLiability = account.type === 'credit_card'
        const selected = value === account.id
        return (
          <button
            key={account.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(account.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
              selected ? 'border-primary bg-primary/5' : 'hover:bg-accent',
            )}
          >
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: account.color }}
            >
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {account.name}
                {account.lastFour && (
                  <span className="text-muted-foreground"> ••••{account.lastFour}</span>
                )}
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 text-sm tabular-nums',
                isLiability && 'text-red-600 dark:text-red-400',
              )}
            >
              {isLiability ? '-' : ''}
              {formatCurrency(account.balanceCents, account.currency)}
            </span>
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                selected ? 'border-primary bg-primary' : 'border-muted-foreground/30',
              )}
            >
              {selected && <span className="bg-primary-foreground size-1.5 rounded-full" />}
            </span>
          </button>
        )
      })}
      {options.length === 0 && (
        <p className="text-muted-foreground text-sm">No accounts available. Add one first.</p>
      )}
    </div>
  )
}
