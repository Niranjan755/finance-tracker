import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getIcon } from '@/lib/icons'
import { useFinanceStore } from '@/store/financeStore'
import type { CategoryType } from '@/types'

export function CategoryManager() {
  const categories = useFinanceStore((s) => s.categories)
  const addCategory = useFinanceStore((s) => s.addCategory)
  const removeCategory = useFinanceStore((s) => s.removeCategory)

  const [name, setName] = useState('')
  const [type, setType] = useState<CategoryType>('expense')

  const custom = categories.filter((c) => !c.isDefault)

  async function handleAdd() {
    if (!name.trim()) return
    await addCategory({ name: name.trim(), type, parentId: null, icon: 'circle-dashed', color: '#6b7280' })
    setName('')
    toast.success('Category added')
  }

  async function handleDelete(id: string) {
    const result = await removeCategory(id)
    if (result.deleted) {
      toast.success('Category deleted')
    } else {
      toast.error('Unable to delete category', { description: result.reason })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-56" />
        <Select value={type} onValueChange={(v) => setType((v ?? 'expense') as CategoryType)} items={{ expense: 'Expense', income: 'Income' }}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>

      {custom.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom categories yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {custom.map((c) => {
            const Icon = getIcon(c.icon)
            return (
              <Badge key={c.id} variant="outline" className="gap-1.5 py-1.5 pl-2 pr-1">
                <Icon className="size-3" aria-hidden="true" />
                {c.name}
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  aria-label={`Delete ${c.name}`}
                  className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
