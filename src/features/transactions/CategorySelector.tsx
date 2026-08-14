import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getIcon } from '@/lib/icons'
import type { Category } from '@/types'

interface CategorySelectorProps {
  categories: Category[]
  type: Category['type']
  value: string
  onChange: (categoryId: string) => void
  id?: string
}

export function CategorySelector({ categories, type, value, onChange, id }: CategorySelectorProps) {
  const groups = useMemo(() => {
    const filtered = categories.filter((c) => c.type === type)
    const parents = filtered.filter((c) => !c.parentId)
    return parents.map((parent) => ({
      parent,
      children: filtered.filter((c) => c.parentId === parent.id),
    }))
  }, [categories, type])

  const items = useMemo(() => {
    const map: Record<string, string> = {}
    for (const { parent, children } of groups) {
      map[parent.id] = `${parent.name} (general)`
      for (const child of children) map[child.id] = child.name
    }
    return map
  }, [groups])

  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? '')} items={items}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Choose a category" />
      </SelectTrigger>
      <SelectContent>
        {groups.map(({ parent, children }) => {
          const ParentIcon = getIcon(parent.icon)
          return (
            <SelectGroup key={parent.id}>
              <SelectLabel className="flex items-center gap-1.5">
                <ParentIcon className="size-3.5" aria-hidden="true" />
                {parent.name}
              </SelectLabel>
              <SelectItem value={parent.id}>{parent.name} (general)</SelectItem>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )
        })}
      </SelectContent>
    </Select>
  )
}
