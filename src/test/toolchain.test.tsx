import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { openDB } from 'idb'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

describe('toolchain smoke test', () => {
  it('resolves the @/ path alias', () => {
    const isActive = false
    expect(cn('a', isActive && 'b', 'c')).toBe('a c')
  })

  it('renders React components in jsdom via Testing Library', () => {
    render(<Button>Add Transaction</Button>)
    expect(screen.getByRole('button', { name: 'Add Transaction' })).toBeInTheDocument()
  })

  it('persists and reads back through IndexedDB', async () => {
    const db = await openDB('toolchain-check', 1, {
      upgrade(database) {
        database.createObjectStore('accounts', { keyPath: 'id' })
      },
    })
    await db.put('accounts', { id: 'acc_1', name: 'Chase Checking', balanceCents: 425050 })

    const account = await db.get('accounts', 'acc_1')
    expect(account).toEqual({ id: 'acc_1', name: 'Chase Checking', balanceCents: 425050 })
    db.close()
  })
})
