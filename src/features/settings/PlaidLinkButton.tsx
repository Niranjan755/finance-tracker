import { useEffect, useState } from 'react'
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link'
import { toast } from 'sonner'
import { Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createLinkToken, exchangePublicToken } from '@/lib/plaid/client'

interface PlaidLinkButtonProps {
  onLinked?: () => void
}

export function PlaidLinkButton({ onLinked }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  async function handleStart() {
    setStarting(true)
    try {
      const { linkToken: token } = await createLinkToken()
      setLinkToken(token)
    } catch (err) {
      toast.error('Unable to start bank linking', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setStarting(false)
    }
  }

  async function handleSuccess(
    publicToken: string | null,
    metadata: PlaidLinkOnSuccessMetadata,
  ) {
    if (!publicToken) return
    try {
      await exchangePublicToken(publicToken, metadata.institution?.name ?? null)
      toast.success('Bank account linked')
      onLinked?.()
    } catch (err) {
      toast.error('Unable to link bank account', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLinkToken(null)
    }
  }

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: handleSuccess,
    onExit: () => setLinkToken(null),
  })

  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  return (
    <Button variant="outline" onClick={handleStart} disabled={starting} className="gap-1.5">
      <Landmark className="size-4" aria-hidden="true" />
      Link a bank account
    </Button>
  )
}
