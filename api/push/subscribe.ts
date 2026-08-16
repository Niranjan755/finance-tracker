import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser } from '../_lib/auth.js'
import { getServiceClient } from '../_lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const user = await requireUser(req)
    const { endpoint, keys } = req.body as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'endpoint and keys.p256dh/keys.auth are required' })
      return
    }

    const supabase = getServiceClient()
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, endpoint, p256dh: keys.p256dh, auth_key: keys.auth },
      { onConflict: 'endpoint' },
    )
    if (error) throw new Error(error.message)

    res.status(200).json({ subscribed: true })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to subscribe' })
  }
}
