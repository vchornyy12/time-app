import 'server-only'
import { getAssistantSecret } from '@/lib/assistant/secrets'

/**
 * Read-only Google Chat access through the generally available Chat REST API,
 * with the user's own OAuth grant (stored encrypted in Vault).
 */
export const CHAT_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/directory.readonly',
]

export const CHAT_OAUTH_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-google-chat-oauth' : 'google-chat-oauth'

const CHAT = 'https://chat.googleapis.com/v1'
const SPACE_NAME = /^spaces\/[A-Za-z0-9_-]{1,100}$/

export function chatOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CHAT_CLIENT_ID && process.env.GOOGLE_CHAT_CLIENT_SECRET)
}

export class ChatNotConnectedError extends Error {
  constructor() { super('Google Chat is not connected. Connect it in Time24 → Settings → Assistant.') }
}

export interface ChatSpace { name: string; displayName?: string; spaceType?: string; lastActiveTime?: string }
interface RawMessage {
  name: string
  createTime: string
  text?: string
  formattedText?: string
  argumentText?: string
  sender?: { name?: string; type?: string; displayName?: string }
  thread?: { name?: string }
  attachment?: unknown[]
}
export interface ChatMessage {
  message_name: string
  created_at: string
  sender: string
  sender_email?: string
  from_me: boolean
  thread?: string
  text: string
  has_attachment: boolean
  url: string
}

type Session = { token: string; me: { id: string; email?: string } }

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CHAT_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CHAT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || typeof body.access_token !== 'string') {
    if (body.error === 'invalid_grant') throw new ChatNotConnectedError()
    throw new Error('Could not refresh the Google Chat token.')
  }
  return body.access_token as string
}

async function get<T>(token: string, url: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const u = new URL(url)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, String(v))
  const res = await fetch(u, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(`Google API ${res.status}: ${body?.error?.message ?? res.statusText}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return body as T
}

/** One request-scoped session: token refresh, identity and a name cache. */
export class ChatSession {
  private names = new Map<string, { name: string; email?: string }>()
  private peopleAvailable = true

  private constructor(private s: Session) {}

  static async open(userId: string) {
    if (!chatOAuthConfigured()) throw new Error('Google Chat is not configured on this server.')
    const refresh = await getAssistantSecret(userId, 'chat')
    if (!refresh) throw new ChatNotConnectedError()
    const token = await refreshAccessToken(refresh)
    const info = await get<{ sub: string; email?: string }>(token, 'https://openidconnect.googleapis.com/v1/userinfo')
    return new ChatSession({ token, me: { id: `users/${info.sub}`, email: info.email } })
  }

  async listSpaces(): Promise<ChatSpace[]> {
    const spaces: ChatSpace[] = []
    let pageToken: string | undefined
    let pages = 0
    do {
      const page = await get<{ spaces?: ChatSpace[]; nextPageToken?: string }>(this.s.token, `${CHAT}/spaces`, { pageSize: 1000, pageToken })
      spaces.push(...(page.spaces ?? []))
      pageToken = page.nextPageToken
    } while (pageToken && ++pages < 5)
    return spaces
  }

  async recentSpaces(): Promise<ChatSpace[]> {
    return (await this.listSpaces())
      .filter((s) => s.lastActiveTime)
      .sort((a, b) => b.lastActiveTime!.localeCompare(a.lastActiveTime!))
  }

  async getSpace(name: string): Promise<ChatSpace> {
    if (!SPACE_NAME.test(name)) throw new Error('space must look like spaces/XXXX')
    return get<ChatSpace>(this.s.token, `${CHAT}/${name}`)
  }

  async rawMessages(space: string, opts: { since?: string; until?: string; limit: number; newestFirst?: boolean }) {
    if (!SPACE_NAME.test(space)) throw new Error('space must look like spaces/XXXX')
    const filters: string[] = []
    if (opts.since) filters.push(`createTime > "${new Date(opts.since).toISOString()}"`)
    if (opts.until) filters.push(`createTime < "${new Date(opts.until).toISOString()}"`)
    const out: RawMessage[] = []
    let pageToken: string | undefined
    do {
      const page = await get<{ messages?: RawMessage[]; nextPageToken?: string }>(this.s.token, `${CHAT}/${space}/messages`, {
        pageSize: Math.min(opts.limit - out.length, 1000),
        pageToken,
        filter: filters.join(' AND '),
        orderBy: opts.newestFirst ? 'createTime desc' : 'createTime asc',
      })
      out.push(...(page.messages ?? []))
      pageToken = page.nextPageToken
    } while (pageToken && out.length < opts.limit)
    return out.slice(0, opts.limit)
  }

  private async resolveUser(userName?: string) {
    if (!userName) return { name: 'unknown' }
    const cached = this.names.get(userName)
    if (cached) return cached
    let result: { name: string; email?: string } = { name: userName }
    if (this.peopleAvailable) {
      try {
        const p = await get<{ names?: { displayName?: string }[]; emailAddresses?: { value?: string }[] }>(
          this.s.token, `https://people.googleapis.com/v1/people/${userName.replace(/^users\//, '')}`,
          { personFields: 'names,emailAddresses', sources: 'READ_SOURCE_TYPE_PROFILE' },
        )
        result = { name: p.names?.[0]?.displayName || userName, email: p.emailAddresses?.[0]?.value }
      } catch (e) {
        if ((e as { status?: number }).status === 403) this.peopleAvailable = false
      }
    }
    this.names.set(userName, result)
    return result
  }

  /** Named spaces keep their name; DMs and unnamed group chats are named after the other members. */
  async title(space: ChatSpace) {
    if (space.displayName) return space.displayName
    try {
      const page = await get<{ memberships?: { member?: { name?: string; type?: string; displayName?: string } }[] }>(
        this.s.token, `${CHAT}/${space.name}/members`, { pageSize: 100 },
      )
      const others = (page.memberships ?? []).map((m) => m.member)
        .filter((m): m is { name: string; type?: string; displayName?: string } => !!m?.name && m.type !== 'BOT' && m.name !== this.s.me.id)
      const names = await Promise.all(others.map(async (m) => m.displayName || (await this.resolveUser(m.name)).name))
      if (names.length) return names.join(', ')
    } catch { /* fall back to the resource name */ }
    return space.name
  }

  async format(space: ChatSpace, m: RawMessage, maxChars = 2000): Promise<ChatMessage> {
    const sender = m.sender?.type === 'BOT'
      ? { name: m.sender.displayName || 'bot', email: undefined }
      : await this.resolveUser(m.sender?.name)
    const text = (m.formattedText || m.text || m.argumentText || '').trim()
    return {
      message_name: m.name,
      created_at: m.createTime,
      sender: sender.name,
      sender_email: sender.email,
      from_me: m.sender?.name === this.s.me.id,
      thread: m.thread?.name,
      text: text.length > maxChars ? `${text.slice(0, maxChars)}…` : text,
      has_attachment: Array.isArray(m.attachment) && m.attachment.length > 0,
      url: messageUrl(space, m.thread?.name),
    }
  }

  async describe(space: ChatSpace) {
    return { space: space.name, title: await this.title(space), type: space.spaceType ?? null, last_active_at: space.lastActiveTime ?? null, url: messageUrl(space) }
  }
}

export function messageUrl(space: ChatSpace, threadName?: string) {
  const id = space.name.replace(/^spaces\//, '')
  const kind = space.spaceType === 'DIRECT_MESSAGE' ? 'dm' : 'room'
  const thread = threadName?.split('/').pop()
  return thread ? `https://chat.google.com/${kind}/${id}/${thread}` : `https://chat.google.com/${kind}/${id}`
}

/** Case-insensitive match of a space title or resource name against the user's mute list. */
export function isMuted(muted: string[], title: string, name: string) {
  const t = title.toLowerCase()
  return muted.some((m) => {
    const x = m.trim().toLowerCase()
    return x.length > 0 && (t.includes(x) || name.toLowerCase() === x)
  })
}
