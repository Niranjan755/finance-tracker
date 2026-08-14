import { ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'

export function AddTransactionMenu({ className }: { className?: string }) {
  const openAddTransaction = useUIStore((s) => s.openAddTransaction)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button className={cn('gap-1.5', className)}>
            <Plus className="size-4" aria-hidden="true" />
            Add Transaction
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => openAddTransaction('expense')}>
          <ArrowDownCircle className="size-4 text-red-500" aria-hidden="true" />
          Add Expense
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openAddTransaction('income')}>
          <ArrowUpCircle className="size-4 text-emerald-500" aria-hidden="true" />
          Add Income
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openAddTransaction('transfer')}>
          <ArrowLeftRight className="size-4 text-blue-500" aria-hidden="true" />
          Transfer Money
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
