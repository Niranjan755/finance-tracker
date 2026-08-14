import { useNavigate } from 'react-router-dom'
import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { getIcon } from '@/lib/icons'
import { formatCurrency } from '@/lib/money'
import type { CategoryBreakdownEntry } from '@/lib/finance/calculations'

interface ExpenseBreakdownChartProps {
  data: CategoryBreakdownEntry[]
}

export function ExpenseBreakdownChart({ data }: ExpenseBreakdownChartProps) {
  const navigate = useNavigate()

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        No expenses in this period.
      </p>
    )
  }

  const chartConfig = Object.fromEntries(
    data.map((d) => [d.categoryId, { label: d.name, color: d.color }]),
  ) satisfies ChartConfig

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ChartContainer config={chartConfig} className="aspect-square h-56 w-full max-w-56 shrink-0">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="categoryId"
                formatter={(value, _name, item) => [
                  `${formatCurrency(Number(value))} (${item.payload.percent}%)`,
                  item.payload.name,
                ]}
              />
            }
          />
          <Pie
            data={data}
            dataKey="amountCents"
            nameKey="categoryId"
            innerRadius="60%"
            outerRadius="100%"
            paddingAngle={2}
            cursor="pointer"
            onClick={(entry) => {
              const categoryId = (entry.payload as CategoryBreakdownEntry | undefined)?.categoryId
              if (categoryId) navigate(`/transactions?category=${categoryId}`)
            }}
          >
            {data.map((entry) => (
              <Cell
                key={entry.categoryId}
                fill={entry.color}
                stroke="var(--background)"
                strokeWidth={2}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((entry) => {
          const Icon = getIcon(entry.icon)
          return (
            <li key={entry.categoryId}>
              <button
                type="button"
                onClick={() => navigate(`/transactions?category=${entry.categoryId}`)}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm"
              >
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${entry.color}1a`, color: entry.color }}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="flex-1 truncate">{entry.name}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {entry.percent}%
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
