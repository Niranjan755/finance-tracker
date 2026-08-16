import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatDisplayDate } from '@/lib/date'
import { formatCurrency } from '@/lib/money'
import { useFinanceStore } from '@/store/financeStore'
import { useAlerts } from './useAlerts'

export function NotificationBell() {
  const navigate = useNavigate()
  const currency = useFinanceStore((s) => s.settings.currency)
  const { budgetAlerts, paymentAlerts, count } = useAlerts()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Bell className="size-4.5" aria-hidden="true" />
            {count > 0 && (
              <span className="bg-destructive absolute top-1.5 right-1.5 flex size-2 rounded-full" />
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        {count === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">You're all caught up.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {budgetAlerts.map((alert) => (
              <button
                key={alert.budget.id}
                onClick={() => navigate('/budgets')}
                className="hover:bg-accent rounded-md p-2 text-left text-sm"
              >
                <p className="font-medium">
                  {alert.progress.status === 'over-budget' ? 'Over budget: ' : 'Near budget limit: '}
                  {alert.category?.name ?? 'Uncategorized'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatCurrency(alert.progress.spentCents, currency)} of{' '}
                  {formatCurrency(alert.budget.amountCents, currency)} spent
                </p>
              </button>
            ))}
            {paymentAlerts.map((alert) => (
              <button
                key={alert.recurring.id}
                onClick={() => navigate('/upcoming')}
                className="hover:bg-accent rounded-md p-2 text-left text-sm"
              >
                <p className="font-medium">{alert.recurring.name}</p>
                <p className="text-muted-foreground text-xs">
                  {alert.daysUntil <= 0
                    ? `Due ${formatDisplayDate(alert.dueDate)}`
                    : `Due in ${alert.daysUntil} day${alert.daysUntil === 1 ? '' : 's'} (${formatDisplayDate(alert.dueDate)})`}
                </p>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
