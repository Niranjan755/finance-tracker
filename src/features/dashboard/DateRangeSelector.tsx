import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DateRangePreset } from '@/lib/finance/timeSeries'

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
]

interface DateRangeSelectorProps {
  value: DateRangePreset
  onChange: (preset: DateRangePreset) => void
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-lg border p-0.5">
      {PRESETS.map((preset) => (
        <Button
          key={preset.value}
          type="button"
          role="radio"
          aria-checked={value === preset.value}
          variant="ghost"
          size="sm"
          onClick={() => onChange(preset.value)}
          className={cn('h-7 px-2.5 text-xs', value === preset.value && 'bg-muted font-medium text-foreground')}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  )
}
