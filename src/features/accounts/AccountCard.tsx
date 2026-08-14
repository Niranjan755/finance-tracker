import { Link } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getIcon } from '@/lib/icons'
import { availableCredit, creditUtilization } from '@/lib/finance/math'
import { formatCurrency } from '@/lib/money'
import { ACCOUNT_TYPE_LABELS } from '@/lib/validation/account'
import type { Account } from '@/types'

interface AccountCardProps {
  account: Account
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
  onDelete: () => void
}

export function AccountCard({ account, onEdit, onDeactivate, onReactivate, onDelete }: AccountCardProps) {
  const Icon = getIcon(account.icon)
  const isCreditCard = account.type === 'credit_card'
  const limit = account.creditLimitCents ?? 0
  const available = isCreditCard ? availableCredit(limit, account.balanceCents) : 0
  const utilization = isCreditCard ? creditUtilization(limit, account.balanceCents) : 0

  return (
    <Card className={`relative gap-3 p-4 ${!account.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <Link to={`/accounts/${account.id}`} className="flex items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: account.color }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {account.institution || ACCOUNT_TYPE_LABELS[account.type]}
            </p>
            <p className="font-medium leading-tight">{account.name}</p>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${account.name}`}>
                <MoreVertical className="size-4" aria-hidden="true" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            {account.isActive ? (
              <DropdownMenuItem onClick={onDeactivate}>Deactivate</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onReactivate}>Reactivate</DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">
          {ACCOUNT_TYPE_LABELS[account.type]} {account.lastFour && `••••${account.lastFour}`}
        </span>
      </div>

      <p className={`text-2xl font-semibold tabular-nums ${isCreditCard ? 'text-red-600 dark:text-red-400' : ''}`}>
        {isCreditCard ? '-' : ''}
        {formatCurrency(account.balanceCents, account.currency)}
      </p>

      {isCreditCard && (
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Available {formatCurrency(available, account.currency)}</span>
            <span>Limit {formatCurrency(limit, account.currency)}</span>
          </div>
          <Progress value={Math.min(utilization, 100)} className={utilization > 90 ? '[&>div]:bg-red-500' : utilization > 75 ? '[&>div]:bg-amber-500' : ''} />
          <p className="text-xs text-muted-foreground">{utilization.toFixed(1)}% utilization</p>
        </div>
      )}

      {!account.isActive && <p className="text-xs font-medium text-muted-foreground">Inactive</p>}
    </Card>
  )
}
