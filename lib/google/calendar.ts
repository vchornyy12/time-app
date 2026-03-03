import { addHours } from 'date-fns'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

/** Exchange a refresh token for a short-lived access token */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Token refresh failed: ${err.error_description ?? err.error ?? res.statusText}`)
  }

  const data = await res.json()
  return data.access_token as string
}

export interface CalendarEventInput {
  summary: string
  scheduledAt?: string // ISO 8601 — required for timed events
  /** All-day event: pass date as 'YYYY-MM-DD' and set allDay: true */
  date?: string
  allDay?: boolean
}

/** Creates a timed (1-hour) or all-day event and returns the Google event ID */
export async function createGCalEvent(
  accessToken: string,
  calendarId: string,
  input: CalendarEventInput
): Promise<string> {
  let eventBody: object

  if (input.allDay && input.date) {
    eventBody = {
      summary: input.summary,
      start: { date: input.date },
      end: { date: input.date },
    }
  } else {
    const start = new Date(input.scheduledAt!)
    const end = addHours(start, 1) // +1 hour
    eventBody = {
      summary: input.summary,
      start: { dateTime: start.toISOString(), timeZone: 'UTC' },
      end: { dateTime: end.toISOString(), timeZone: 'UTC' },
    }
  }

  const res = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Create event failed: ${err.error?.message ?? res.statusText}`)
  }

  const data = await res.json()
  return data.id as string
}

/** Updates an existing event's start/end time */
export async function updateGCalEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  scheduledAt: string
): Promise<void> {
  const start = new Date(scheduledAt)
  const end = addHours(start, 1)

  const res = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start: { dateTime: start.toISOString(), timeZone: 'UTC' },
        end: { dateTime: end.toISOString(), timeZone: 'UTC' },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Update event failed: ${err.error?.message ?? res.statusText}`)
  }
}

/** Deletes an event — 404/410 treated as success (already deleted) */
export async function deleteGCalEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Delete event failed: ${res.statusText}`)
  }
}
