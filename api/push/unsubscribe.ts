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
    const supabase = getServiceClient()
    const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
    if (error) throw new Error(error.message)

    res.status(200).json({ unsubscribed: true })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to unsubscribe' })
  }
}
