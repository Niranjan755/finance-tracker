import webpush from 'web-push'

let configured = false

/** Lazily configures the web-push library with this deployment's VAPID keys. */
export function getWebPush(): typeof webpush {
  if (!configured) {
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT
    if (!publicKey || !privateKey || !subject) {
      throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT must be set')
    }
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  }
  return webpush
}
