# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo with two independent apps sharing the same Supabase backend:

- **`/` (root)** — Next.js 16 web app (GTD productivity tool)
- **`/mobile`** — React Native / Expo app (companion mobile client)

They have separate `package.json` files and `node_modules`. Run commands from the appropriate directory.

## Web App Commands (run from repo root)

```bash
npm run dev          # Start Next.js dev server on http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run
npm run test:e2e     # Playwright E2E tests (requires dev server running or auto-starts it)
npm run test:e2e:ui  # Playwright with UI
```

Run a single unit test file:
```bash
npx vitest run lib/actions/tasks.validation.test.ts
```

Run a single E2E test file:
```bash
npx playwright test tests/e2e/inbox/inbox.spec.ts
```

## Mobile App Commands (run from `/mobile`)

```bash
cd mobile
npx expo start        # Start Expo dev server
npx expo run:android  # Build and run on Android
npx expo run:ios      # Build and run on iOS
npx expo lint         # ESLint
```

## Architecture

### Web App

**Next.js App Router** with two route groups:

- `app/(auth)/` — unauthenticated pages (login, register, reset-password, update-password)
- `app/(app)/` — authenticated pages guarded by both middleware and the layout server component
- `app/api/google/` — API routes for Google Calendar OAuth flow
- `app/auth/callback/` — Supabase auth callback handler

**Authentication flow:** `middleware.ts` → `lib/supabase/middleware.ts` refreshes the Supabase session on every request. The `app/(app)/layout.tsx` double-checks auth server-side and redirects if no user.

**Data layer — Server Actions only.** All mutations go through `'use server'` functions in `lib/actions/`. Pages fetch data directly via the server Supabase client; there is no API layer for reads. Every server action calls `authedClient()` from `lib/actions/authed-action.ts` which validates the session and returns `{ supabase, user }`.

**Supabase clients:**
- `lib/supabase/server.ts` — cookie-based server client (Server Components, Server Actions, Route Handlers)
- `lib/supabase/client.ts` — browser client (Client Components)
- `lib/supabase/admin.ts` — service-role client (admin-only operations)
- `lib/supabase/middleware.ts` — session-refresh client used only in middleware

**Validation:** All server action inputs are validated with Zod schemas defined in `lib/validation/schemas.ts` before touching the database.

**Types:** Shared TypeScript types live in `lib/types/index.ts`. The core domain objects are `Task`, `Project`, `DailyReflection`, `ClaritySession`, and `UserIntegration`.

**GTD task lifecycle:** Tasks flow through statuses: `inbox` → (processed to) `next_actions` | `waiting_for` | `calendar` | `someday_maybe` | `notes` | `trash` | `done`. Processing logic is in `lib/actions/processing.ts`.

**Google Calendar integration:** `lib/google/calendar.ts` and `lib/actions/calendar.ts` handle syncing `waiting_for` tasks as Google Calendar reminders. OAuth tokens are stored in `user_integrations` table.

### Mobile App

**Expo Router** with file-based routing:
- `mobile/app/(auth)/` — login screen (magic link via Supabase)
- `mobile/app/(tabs)/` — authenticated tab bar (Today, Inbox)

Auth state is managed in `mobile/app/_layout.tsx` which listens to `supabase.auth.onAuthStateChange` and handles deep links for magic link callbacks (`timeapp://auth`).

Supabase client for mobile is in `mobile/lib/supabase.ts`; auth helpers in `mobile/lib/auth.ts`.

### Database (Supabase)

Migrations are in `supabase/migrations/` and must be applied in order. The full combined schema is at `supabase/full_schema.sql`. All tables use Row Level Security — every query is automatically scoped to `auth.uid()`.

Key tables: `tasks`, `projects`, `user_integrations`, `user_preferences`, `user_contexts`, `daily_reflections`, `clarity_sessions`.

## Environment Variables

Web app requires `.env.local` at the repo root:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=
```

Mobile app requires `mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

E2E tests require `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in `.env.local`. Playwright saves auth state to `playwright/.auth/user.json` via `tests/e2e/global-setup.ts`.

## Testing Notes

- **Unit tests** (Vitest): files named `*.test.ts` or `*.test.tsx` anywhere in the tree. Run in jsdom environment. Path alias `@/` maps to the repo root.
- **E2E tests** (Playwright): files in `tests/e2e/`. Run single-worker, non-parallel. Auth tests in `tests/e2e/auth/` run without saved auth state; all other tests depend on the global setup that pre-logs in.
- E2E tests auto-start the dev server if one isn't already running (`reuseExistingServer: true` in dev).
