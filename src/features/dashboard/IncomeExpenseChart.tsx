import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { MonthlyIncomeExpensePoint } from '@/lib/finance/timeSeries'

const chartConfig = {
  incomeCents: { label: 'Income', theme: { light: '#059669', dark: '#34d399' } },
  expenseCents: { label: 'Expenses', theme: { light: '#dc2626', dark: '#f87171' } },
} satisfies ChartConfig

export function IncomeExpenseChart({ data }: { data: MonthlyIncomeExpensePoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
          tickFormatter={(v: number) => `$${Math.round(v / 100 / 1000)}k`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => [
                `$${(Number(value) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                name === 'incomeCents' ? 'Income' : 'Expenses',
              ]}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="incomeCents" fill="var(--color-incomeCents)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenseCents" fill="var(--color-expenseCents)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
