import type { VercelRequest } from '@vercel/node'
import { getServiceClient } from './supabase.js'

export interface AuthedUser {
  id: string
  email: string | null
}

/** Verifies the caller's Supabase session JWT (sent as `Authorization: Bearer <token>`). */
export async function requireUser(req: VercelRequest): Promise<AuthedUser> {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) throw new Error('Missing Authorization header')

  const supabase = getServiceClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error('Invalid or expired session')

  return { id: data.user.id, email: data.user.email ?? null }
}
