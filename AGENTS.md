# Repository Guidelines

## Project Structure & Module Organization

This GTD task manager uses Next.js 16, React 19, TypeScript, Supabase, and Tailwind CSS 4. `app/` contains App Router pages and API routes; `components/` groups UI by feature. `lib/` holds server actions, validation, Supabase clients, hooks, and shared types. Static assets live in `public/`. Database migrations and seeds live in `supabase/`. The Expo/React Native companion app is in `mobile/`, with its own dependencies. Browser tests live in `tests/e2e/`; unit tests sit beside source files.

## Build, Test, and Development Commands

Run web commands from the repository root:

- `npm ci`: install locked dependencies.
- `npm run dev`: start the web app at `http://localhost:3000`.
- `npm run build`: create the production build with webpack.
- `npm start`: serve the production build.
- `npm run lint`: run ESLint with Next.js Core Web Vitals and TypeScript rules.
- `npx tsc --noEmit`: check web TypeScript types.
- `npm run test:run`: run web unit/component tests once; `npm test` enables watch mode.
- `npm run test:e2e`: run Playwright; it starts the development server automatically.
- `npm run test:landing`: run the dedicated landing-page browser suite.
- `npm run test:mobile-security`: run the separate mobile Vitest suite.
- `cd mobile && npm ci && npm start`: install and start Expo.

## Coding Style & Naming Conventions

Follow nearby code: feature TypeScript generally uses two-space indentation, single quotes, and no semicolons. Use strict types, avoid `any`, and prefer `@/` imports for shared web modules. Name components in PascalCase and hooks with a `use` prefix. Preserve Next.js filenames such as `page.tsx` and `route.ts`. Add client boundaries only when needed; validate server inputs with Zod.

## Testing Guidelines

Use Vitest, jsdom, and React Testing Library for `*.test.ts` and `*.test.tsx`; use Playwright `*.spec.ts` for browser flows. Authenticated E2E tests require `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in `.env.local`. No numeric coverage threshold is configured; cover changed behavior and meaningful failure cases.

## Commit & Pull Request Guidelines

History uses imperative summaries and occasional `feat:`, `fix:`, or `chore:` prefixes. Keep commits focused. Follow `REVIEW_CHECKLIST.md`: link relevant issues, explain behavior changes, record validation, and keep PRs below 400 lines where practical. Include screenshots for visible UI changes.

## Security & Configuration

Keep secrets, credentials, and session artifacts out of commits and logs. Use the appropriate server/client Supabase helper, enforce authenticated ownership, and maintain RLS policies for affected tables.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
