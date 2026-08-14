import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/money'
import type { SpendingTrendPoint } from '@/lib/finance/timeSeries'

const chartConfig = {
  expenseCents: { label: 'Spending', theme: { light: '#dc2626', dark: '#f87171' } },
} satisfies ChartConfig

export function SpendingTrendChart({ data }: { data: SpendingTrendPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8 }}>
        <defs>
          <linearGradient id="spendingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-expenseCents)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-expenseCents)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
          tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [formatCurrency(Number(value)), 'Spending']}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="expenseCents"
          stroke="var(--color-expenseCents)"
          fill="url(#spendingFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}
