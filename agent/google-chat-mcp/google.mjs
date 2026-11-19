// Google OAuth + Chat REST helpers for the local Google Chat MCP server.
// No dependencies: Node 22 fetch only.

import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const CONFIG_DIR = process.env.TIME24_CHAT_DIR || join(homedir(), '.config', 'time24-chat')
export const CLIENT_FILE = join(CONFIG_DIR, 'client.json')
export const TOKEN_FILE = join(CONFIG_DIR, 'token.json')

export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/directory.readonly',
]

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function writeSecretJson(path, value) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await writeFile(path, JSON.stringify(value, null, 2), { mode: 0o600 })
  await chmod(path, 0o600)
}

export async function loadClient() {
  let client
  try {
    client = await readJson(CLIENT_FILE)
  } catch {
    throw new Error(`Missing ${CLIENT_FILE}. Create it with {"client_id": "...", "client_secret": "..."}.`)
  }
  if (!client.client_id || !client.client_secret) {
    throw new Error(`${CLIENT_FILE} must contain client_id and client_secret.`)
  }
  return client
}

let cachedToken = null // { access_token, expires_at }

export async function getAccessToken() {
  if (cachedToken && cachedToken.expires_at - 60_000 > Date.now()) return cachedToken.access_token
  const client = await loadClient()
  let stored
  try {
    stored = await readJson(TOKEN_FILE)
  } catch {
    throw new Error('Not signed in. Run: node agent/google-chat-mcp/auth.mjs')
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.client_id,
      client_secret: client.client_secret,
      refresh_token: stored.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Token refresh failed (${body.error || res.status}). Run: node agent/google-chat-mcp/auth.mjs`)
  }
  cachedToken = { access_token: body.access_token, expires_at: Date.now() + body.expires_in * 1000 }
  return cachedToken.access_token
}

async function api(url, params = {}) {
  const u = new URL(url)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v))
  }
  const token = await getAccessToken()
  const res = await fetch(u, { headers: { authorization: `Bearer ${token}` } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText
    const err = new Error(`${u.host}${u.pathname} → ${res.status}: ${msg}`)
    err.status = res.status
    throw err
  }
  return body
}

const CHAT = 'https://chat.googleapis.com/v1'

export async function listAllSpaces() {
  const spaces = []
  let pageToken
  do {
    const page = await api(`${CHAT}/spaces`, { pageSize: 1000, pageToken })
    spaces.push(...(page.spaces || []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return spaces
}

export async function listMessages(space, { since, until, limit = 50, newestFirst = false } = {}) {
  const filters = []
  if (since) filters.push(`createTime > "${new Date(since).toISOString()}"`)
  if (until) filters.push(`createTime < "${new Date(until).toISOString()}"`)
  const messages = []
  let pageToken
  do {
    const page = await api(`${CHAT}/${space}/messages`, {
      pageSize: Math.min(limit - messages.length, 1000),
      pageToken,
      filter: filters.join(' AND '),
      orderBy: newestFirst ? 'createTime desc' : 'createTime asc',
    })
    messages.push(...(page.messages || []))
    pageToken = page.nextPageToken
  } while (pageToken && messages.length < limit)
  return messages.slice(0, limit)
}

export async function getSpace(space) {
  return api(`${CHAT}/${space}`)
}

export async function listMembers(space) {
  const page = await api(`${CHAT}/${space}/members`, { pageSize: 100 })
  return page.memberships || []
}

let me = null
export async function getMe() {
  if (me) return me
  const info = await api('https://openidconnect.googleapis.com/v1/userinfo')
  me = { id: `users/${info.sub}`, name: info.name, email: info.email }
  return me
}

// users/{id} → display name. Chat user auth does not return names, so ask the
// People API (domain directory). Falls back to the raw ID if that is not
// available (People API disabled or no directory access).
const names = new Map()
let peopleUnavailable = false
export async function resolveUser(userName) {
  if (!userName) return { id: null, name: 'unknown' }
  if (names.has(userName)) return names.get(userName)
  const id = userName.replace(/^users\//, '')
  let result = { id: userName, name: userName }
  if (!peopleUnavailable) {
    try {
      const p = await api(`https://people.googleapis.com/v1/people/${id}`, {
        personFields: 'names,emailAddresses',
        sources: 'READ_SOURCE_TYPE_PROFILE',
      })
      result = {
        id: userName,
        name: p.names?.[0]?.displayName || userName,
        email: p.emailAddresses?.[0]?.value,
      }
    } catch (e) {
      if (e.status === 403) peopleUnavailable = true
    }
  }
  names.set(userName, result)
  return result
}

export function spaceUrl(space) {
  const id = space.name.replace(/^spaces\//, '')
  return space.spaceType === 'DIRECT_MESSAGE'
    ? `https://chat.google.com/dm/${id}`
    : `https://chat.google.com/room/${id}`
}

export function messageUrl(space, message) {
  const spaceId = space.name.replace(/^spaces\//, '')
  const threadId = message.thread?.name?.split('/').pop()
  const kind = space.spaceType === 'DIRECT_MESSAGE' ? 'dm' : 'room'
  return threadId
    ? `https://chat.google.com/${kind}/${spaceId}/${threadId}`
    : `https://chat.google.com/${kind}/${spaceId}`
}

// Human-readable title: named spaces keep their name; DMs and unnamed group
// chats are named after the other participants.
export async function spaceTitle(space) {
  if (space.displayName) return space.displayName
  try {
    const myself = await getMe()
    const members = await listMembers(space.name)
    const others = members
      .map((m) => m.member)
      .filter((m) => m && m.type !== 'BOT' && m.name !== myself.id)
    const resolved = await Promise.all(others.map((m) => resolveUser(m.name)))
    if (resolved.length) return resolved.map((r) => r.name).join(', ')
  } catch {
    // fall through
  }
  return space.name
}

export async function formatMessage(space, message, maxChars = 2000) {
  const sender = message.sender?.type === 'BOT'
    ? { name: message.sender.displayName || 'bot' }
    : await resolveUser(message.sender?.name)
  const text = (message.formattedText || message.text || message.argumentText || '').trim()
  return {
    message_name: message.name,
    created_at: message.createTime,
    sender: sender.name,
    sender_email: sender.email,
    thread: message.thread?.name,
    text: text.length > maxChars ? `${text.slice(0, maxChars)}…` : text,
    has_attachment: Boolean(message.attachment?.length),
    url: messageUrl(space, message),
  }
}
