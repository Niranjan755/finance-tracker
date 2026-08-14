import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/money'
import type { AccountBalancePoint } from '@/lib/finance/timeSeries'
import type { Account } from '@/types'

interface AccountBalanceChartProps {
  data: AccountBalancePoint[]
  accounts: Account[]
}

export function AccountBalanceChart({ data, accounts }: AccountBalanceChartProps) {
  const chartConfig = Object.fromEntries(
    accounts.map((a) => [a.id, { label: a.name, color: a.color }]),
  ) satisfies ChartConfig

  const flatData = data.map((point) => ({ label: point.label, ...point.balances }))

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <LineChart data={flatData} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={52}
          tickFormatter={(v: number) => `$${Math.round(v / 100 / 1000)}k`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
            />
          }
        />
        <Legend />
        {accounts.map((account) => (
          <Line
            key={account.id}
            type="monotone"
            dataKey={account.id}
            name={account.name}
            stroke={`var(--color-${account.id})`}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
