import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceClient } from '../_lib/supabase.js'
import { loadAppState, saveAppState } from '../_lib/appState.js'
import { getWebPush } from '../_lib/webPush.js'
import { computeBudgetAlerts, computeUpcomingPaymentAlerts } from '../../src/lib/finance/alerts.js'
import { computeMonthlyStatement } from '../../src/lib/finance/calculations.js'
import { isDateInRange, listRecentMonths, monthKey, todayISODate } from '../../src/lib/date.js'
import { formatCurrency } from '../../src/lib/money.js'

interface PushSubscriptionRow {
  user_id: string
  endpoint: string
  p256dh: string
  auth_key: string
}

interface PendingMessage {
  title: string
  body: string
  url: string
  dedupKey: string
}

/**
 * Runs daily via Vercel Cron (see vercel.json). For every user with at least
 * one push subscription, computes the same budget/bill/monthly-report alerts
 * the in-app notification bell shows, skips anything already sent (tracked
 * in sent_notifications), and pushes the rest via web-push. Stale
 * subscriptions (410/404 from the push service) are cleaned up as they're hit.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const supabase = getServiceClient()
  const webpush = getWebPush()

  const { data: subsData, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth_key')
  if (subsError) {
    res.status(500).json({ error: subsError.message })
    return
  }
  const subs = (subsData ?? []) as PushSubscriptionRow[]

  const subsByUser = new Map<string, PushSubscriptionRow[]>()
  for (const sub of subs) {
    const list = subsByUser.get(sub.user_id) ?? []
    list.push(sub)
    subsByUser.set(sub.user_id, list)
  }

  const today = todayISODate()
  let notificationsSent = 0

  for (const [userId, userSubs] of subsByUser) {
    const payload = await loadAppState(supabase, userId)
    const { notifications, currency } = payload.settings

    const { data: sentRows } = await supabase
      .from('sent_notifications')
      .select('dedup_key')
      .eq('user_id', userId)
    const alreadySent = new Set(((sentRows ?? []) as { dedup_key: string }[]).map((r) => r.dedup_key))

    const messages: PendingMessage[] = []

    if (notifications.budgetAlerts) {
      const alerts = computeBudgetAlerts(
        payload.budgets,
        payload.transactions,
        payload.categories,
        payload.accounts,
        currency,
        today,
      )
      for (const alert of alerts) {
        const dedupKey = `budget:${alert.budget.id}:${alert.budget.year}-${alert.budget.month}`
        if (alreadySent.has(dedupKey)) continue
        messages.push({
          title: alert.progress.status === 'over-budget' ? 'Over budget' : 'Near budget limit',
          body: `${alert.category?.name ?? 'Uncategorized'}: ${formatCurrency(alert.progress.spentCents, currency)} of ${formatCurrency(alert.budget.amountCents, currency)} spent`,
          url: '/budgets',
          dedupKey,
        })
      }
    }

    if (notifications.upcomingPayments) {
      const alerts = computeUpcomingPaymentAlerts(payload.recurring, today)
      for (const alert of alerts) {
        const dedupKey = `bill:${alert.recurring.id}:${alert.dueDate}`
        if (alreadySent.has(dedupKey)) continue
        messages.push({
          title: alert.recurring.name,
          body:
            alert.daysUntil <= 0
              ? 'Due today'
              : `Due in ${alert.daysUntil} day${alert.daysUntil === 1 ? '' : 's'}`,
          url: '/upcoming',
          dedupKey,
        })
      }
    }

    if (notifications.monthlyReports) {
      const thisMonthKey = monthKey(today)
      if (payload.settings.lastMonthlyReportMonth !== thisMonthKey) {
        const lastMonthBounds = listRecentMonths(2)[1]
        if (lastMonthBounds) {
          const hasData = payload.transactions.some((t) =>
            isDateInRange(t.date, lastMonthBounds.startISO, lastMonthBounds.endISO),
          )
          if (hasData) {
            const statement = computeMonthlyStatement(
              payload.accounts,
              payload.transactions,
              payload.transfers,
              lastMonthBounds,
              currency,
            )
            messages.push({
              title: `${lastMonthBounds.label} summary`,
              body: `${formatCurrency(statement.totalIncomeCents, currency)} in, ${formatCurrency(statement.totalExpenseCents, currency)} out`,
              url: '/reports',
              dedupKey: `report:${thisMonthKey}`,
            })
          }
        }
        // Shared with the in-app monthly-report toast (App.tsx) so whichever
        // channel fires first - this cron or the user opening the app - is
        // the only one that shows it.
        await saveAppState(supabase, userId, {
          ...payload,
          settings: { ...payload.settings, lastMonthlyReportMonth: thisMonthKey },
        })
      }
    }

    if (messages.length === 0) continue

    for (const sub of userSubs) {
      const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }
      for (const message of messages) {
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({ title: message.title, body: message.body, url: message.url }),
          )
          notificationsSent += 1
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          } else {
            console.error('Push send failed', userId, err)
          }
        }
      }
    }

    await supabase
      .from('sent_notifications')
      .upsert(
        messages.map((m) => ({ user_id: userId, dedup_key: m.dedupKey })),
        { onConflict: 'user_id,dedup_key' },
      )
  }

  res.status(200).json({ usersProcessed: subsByUser.size, notificationsSent })
}
