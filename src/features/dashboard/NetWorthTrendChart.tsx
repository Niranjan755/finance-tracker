import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/money'
import type { NetWorthTrendPoint } from '@/lib/finance/timeSeries'

const chartConfig = {
  netWorthCents: { label: 'Net Worth', theme: { light: '#2a78d6', dark: '#3987e5' } },
} satisfies ChartConfig

export function NetWorthTrendChart({ data }: { data: NetWorthTrendPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <LineChart data={data} margin={{ left: 0, right: 8 }}>
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
              formatter={(value) => [formatCurrency(Number(value)), 'Net Worth']}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="netWorthCents"
          stroke="var(--color-netWorthCents)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
