# Mobile App Design — GTD Companion

**Date:** 2026-04-20
**Status:** Approved

## Overview

A focused React Native (Expo) companion app for the GTD web app. v1 scope: quick task capture and today's calendar view + inbox list. Architected for future full feature parity with the web app.

---

## Goals

- **v1:** Capture tasks to inbox on the go; see today's scheduled items; view inbox list
- **Future:** Full feature parity (processing, projects, next actions, logbook, weekly review)

---

## Approach

**Expo monorepo (Approach A):** `mobile/` folder added to the existing repo. The Expo app imports shared TypeScript types and validation schemas directly from `../../lib` via a path alias. No monorepo tooling (workspaces, Turborepo) needed for v1.

---

## Project Structure

```
time-app/
├── app/                        # Next.js web app (unchanged)
├── lib/                        # Shared logic (unchanged)
│   ├── types/index.ts          # ← imported by mobile via @shared alias
│   ├── validation/schemas.ts   # ← imported by mobile via @shared alias
│   └── supabase/               # NOT shared — server-only (uses Next.js cookies)
├── mobile/                     # Expo app (new)
│   ├── app/
│   │   ├── _layout.tsx         # Root layout, auth gate, tab bar
│   │   ├── index.tsx           # Today screen (calendar tasks)
│   │   ├── inbox.tsx           # Inbox list screen
│   │   └── capture.tsx         # Quick capture modal screen
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client (Expo-compatible, AsyncStorage session)
│   │   └── auth.ts             # Magic link helpers, deep link handler
│   ├── components/             # Native UI components
│   ├── tsconfig.json           # Path alias: @shared → ../../lib
│   ├── app.json                # Expo config (bundle id, scheme: "timeapp", icon)
│   ├── eas.json                # EAS build profiles (preview APK, production AAB)
│   └── package.json            # Own deps: expo, react-native, @supabase/supabase-js
├── netlify.toml                # New: ignore mobile/ changes to skip unnecessary web builds
└── package.json                # Unchanged
```

---

## Screens & Navigation

### Auth Gate
- **Login screen** — email input + "Send magic link" button
- On deep link return (`timeapp://auth`) — exchange token, store session, redirect to Today

### Main App — Bottom Tab Bar

| Tab | Screen | Content |
|-----|--------|---------|
| 1 | Today | Calendar tasks scheduled for today, sorted by time. Shows: time + title + Google Calendar sync indicator. Empty state: "Nothing scheduled today." |
| 2 | Inbox | All inbox tasks, sorted newest first. Shows: title. Inbox item count in header. Empty state: "Inbox clear." Tap to see title (view only — processing stays on web). |
| 3 (center) | Capture | Full-screen modal. Autofocused text input. "Add to Inbox" button. Dismisses on success with brief confirmation. Accessible from any tab. |

---

## Data Flow

### Authentication — Magic Link
```
User enters email
→ supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: 'timeapp://auth' } })
→ User taps email link
→ Android deep link opens app at timeapp://auth with token params
→ Expo Router catches deep link, supabase.auth.exchangeCodeForSession()
→ Session persisted to AsyncStorage
→ Redirect to Today tab
```

### Today Screen Query
```sql
SELECT id, title, scheduled_at, google_calendar_event_id
FROM tasks
WHERE user_id = :uid
  AND status = 'calendar'
  AND scheduled_at >= startOfToday
  AND scheduled_at <  endOfToday
ORDER BY scheduled_at ASC
```

### Inbox Screen Query
```sql
SELECT id, title, created_at
FROM tasks
WHERE user_id = :uid
  AND status = 'inbox'
ORDER BY created_at DESC
```

### Quick Capture
```sql
INSERT INTO tasks (title, status, user_id)
VALUES (:title, 'inbox', :uid)
```

### Key Data Decisions
- Direct Supabase client calls — no server actions on mobile
- RLS policies already enforce `user_id` ownership — queries are safe
- No offline support in v1 — show error state on no connection
- No realtime subscriptions in v1 — pull-to-refresh is sufficient

---

## Build Process

### Development
```bash
cd mobile
npm install
npx expo install          # sync native deps
adb devices               # verify phone connected (USB debugging on)
npx expo run:android      # build debug APK, install to phone, start Metro (hot reload)
```

### Shareable APK (local, no cloud)
```bash
npm install -g eas-cli
eas build --platform android --profile preview --local
# outputs .apk file for direct sideload
```

### `eas.json` profiles
```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

### Netlify — ignore mobile-only pushes
```toml
[build]
  command = "npm run build"
  publish = ".next"
  ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- . ':!mobile'"

[build.environment]
  NODE_VERSION = "20"
```

---

## Shared Code

| Asset | Shared? | Notes |
|-------|---------|-------|
| `lib/types/index.ts` | Yes | Via `@shared` TypeScript path alias |
| `lib/validation/schemas.ts` | Yes | Via `@shared` alias |
| `lib/supabase/server.ts` | No | Uses Next.js cookies API — server only |
| `lib/supabase/middleware.ts` | No | Next.js middleware only |
| `lib/actions/*` | No | Next.js server actions — not available in React Native |

---

## Future Expansion Path

v1 is intentionally minimal. The architecture supports growth:

1. **v2 — Processing on mobile:** Add processing screens (next action, calendar, someday, waiting for). Reuse `lib/validation/schemas.ts` for input validation.
2. **v3 — Projects & Next Actions:** Project list, next action list per context.
3. **v4 — Full parity:** Logbook, weekly review, analytics.
4. **If shared code grows large:** Migrate to npm workspaces with a `packages/shared` package — mechanical refactor, no architectural rethink needed.

---

## Out of Scope (v1)

- Google OAuth on mobile (requires Android OAuth client setup)
- Google Calendar sync from mobile (view only via `google_calendar_event_id` indicator)
- Offline mode
- Push notifications
- iOS build
