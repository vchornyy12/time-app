import 'server-only'
import { getAssistantSecret } from './secrets'

/**
 * Notifications go to a Google Chat incoming webhook the user created in a
 * space of their own ("Time24 Assistant"). Messages are posted by the webhook
 * app, so the user gets a normal Chat notification.
 */
const SPACE_PATH = /^\/v1\/spaces\/[A-Za-z0-9_-]{1,100}\/messages$/

/**
 * Returns the canonical webhook URL (https://chat.googleapis.com/v1/spaces/X/messages?key=…&token=…)
 * or null. Accepts the URL however Chat's "Copy link" encoded it (e.g. a token ending in "=" or "%3D").
 */
export function normalizeWebhookUrl(raw: string): string | null {
  const input = raw.trim()
  if (input.length > 2000) return null
  let url: URL
  try { url = new URL(input) } catch { return null }
  if (url.protocol !== 'https:' || url.hostname !== 'chat.googleapis.com' || url.port || url.username || url.password) return null
  if (!SPACE_PATH.test(url.pathname)) return null
  const key = url.searchParams.get('key')
  const token = url.searchParams.get('token')
  if (!key || !token) return null
  const out = new URL(`https://chat.googleapis.com${url.pathname}`)
  out.searchParams.set('key', key)
  out.searchParams.set('token', token)
  return out.toString()
}

export function isValidWebhookUrl(url: string) {
  return normalizeWebhookUrl(url) === url.trim()
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
