import 'server-only'
import { getAssistantSecret } from './secrets'

/**
 * Notifications go to a Google Chat incoming webhook the user created in a
 * space of their own ("Time24 Assistant"). Messages are posted by the webhook
 * app, so the user gets a normal Chat notification.
 */
const WEBHOOK = /^https:\/\/chat\.googleapis\.com\/v1\/spaces\/[A-Za-z0-9_-]{1,100}\/messages\?(?:[A-Za-z0-9_]+=[A-Za-z0-9_%.~-]+&?){1,4}$/

export function isValidWebhookUrl(url: string) {
  if (url.length > 2000 || !WEBHOOK.test(url)) return false
  const params = new URL(url).searchParams
  return params.has('key') && params.has('token')
}

export class NotifyNotConnectedError extends Error {
  constructor() { super('Notifications are not set up. Add a Google Chat webhook in Time24 → Settings → Assistant.') }
}

export async function postToWebhook(url: string, text: string) {
  if (!isValidWebhookUrl(url)) throw new Error('Invalid webhook URL.')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ text: text.slice(0, 4000) }),
    cache: 'no-store',
    redirect: 'error',
  })
  if (!res.ok) throw new Error(`Google Chat rejected the notification (${res.status}).`)
}

export async function notifyUser(userId: string, text: string) {
  const url = await getAssistantSecret(userId, 'notify')
  if (!url) throw new NotifyNotConnectedError()
  await postToWebhook(url, text)
}
