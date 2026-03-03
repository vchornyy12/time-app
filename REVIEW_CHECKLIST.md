# Code Review Checklist — GTD App

> **Stack:** Next.js 16 · React 19 · TypeScript · Supabase · Tailwind v4 · Zod · dnd-kit
> **Severity labels:** 🔴 Blocking · 🟡 Important · 🟢 Nit · 💡 Suggestion · 🎉 Praise

---

## 1. PR Hygiene

- [ ] PR has a clear title and description linking to the relevant issue
- [ ] PR is < 400 lines (request split if larger)
- [ ] CI passes (lint, build, type-check)
- [ ] No unrelated changes bundled in

---

## 2. TypeScript & Type Safety

- [ ] No `any` types — use proper interfaces or `unknown`
- [ ] Zod schemas match the expected Supabase row types
- [ ] Server action return types are explicit (not inferred `any`)
- [ ] Generic components have constrained type parameters
- [ ] `@/*` path aliases used consistently (no relative `../../../`)

---

## 3. Next.js App Router

- [ ] `"use client"` directive only where necessary (not on server components)
- [ ] `"use server"` directive present on all server action files
- [ ] Route handlers (`route.ts`) return proper `NextResponse` with status codes
- [ ] `loading.tsx` exists for pages with async data fetching
- [ ] `error.tsx` boundaries handle failures gracefully
- [ ] `not-found.tsx` used for invalid dynamic routes (`[id]`)
- [ ] Metadata (`generateMetadata` or static `metadata`) is set on pages
- [ ] No client-side `fetch` for data that should be server-fetched

---

## 4. Supabase & Data Access

- [ ] `createClient()` uses the correct variant:
  - `lib/supabase/server.ts` for Server Components and Server Actions
  - `lib/supabase/client.ts` for Client Components
  - `lib/supabase/middleware.ts` for middleware only
- [ ] All queries filter by authenticated user (`user.id`) — no cross-user data leaks
- [ ] `.single()` is used only when exactly one row is expected
- [ ] Error responses from Supabase are checked (`if (error) ...`)
- [ ] No raw SQL or `.rpc()` calls without input sanitization
- [ ] Row-Level Security (RLS) policies exist for every table touched
- [ ] Batch operations use transactions where atomicity is needed

---

## 5. Authentication & Authorization

- [ ] Protected routes check auth state (middleware or server-side)
- [ ] `auth/callback/route.ts` handles OAuth errors gracefully
- [ ] Google Calendar OAuth tokens are stored securely (not in localStorage)
- [ ] Server actions validate the session before mutating data (`authed-action.ts`)
- [ ] No sensitive data (keys, tokens) in client-side code or logs

---

## 6. React & Component Quality

- [ ] Components have a single responsibility
- [ ] Props don't mutate — data flows down, events flow up
- [ ] `useEffect` dependencies are correct (no missing deps, no over-firing)
- [ ] `key` props on lists use stable IDs (not array index unless static)
- [ ] Event handlers are memoized with `useCallback` only when passed as props to memoized children
- [ ] No direct DOM manipulation — use refs when needed
- [ ] Loading and empty states are handled (Spinner, EmptyState, Skeleton)
- [ ] Modals use `useFocusTrap` for accessibility

---

## 7. Forms & Validation

- [ ] Zod schemas validate all user input before server action execution
- [ ] Error messages are user-friendly (not raw Zod paths)
- [ ] Form submissions are disabled while pending (`useFormStatus` or local state)
- [ ] Optimistic updates revert on server action failure
- [ ] Date inputs use `date-fns` consistently (no raw `Date` parsing)

---

## 8. Drag & Drop (dnd-kit)

- [ ] `DndContext` has proper `onDragEnd` error handling
- [ ] Sortable items use stable `id` values
- [ ] Drag operations trigger server-side reorder (not just local state)
- [ ] Keyboard accessibility works (`KeyboardSensor` configured)
- [ ] Drop animations don't cause layout shift

---

## 9. Styling (Tailwind v4)

- [ ] Uses `cn()` utility for conditional class merging
- [ ] No inline styles when Tailwind classes suffice
- [ ] Responsive design (`sm:`, `md:`, `lg:`) for layout changes
- [ ] Dark mode handled if applicable (`dark:` variants)
- [ ] GlassPanel and other UI primitives are used consistently
- [ ] No unused or conflicting Tailwind classes

---

## 10. Security

- [ ] No `dangerouslySetInnerHTML` unless content is sanitized
- [ ] API route handlers validate request method and body
- [ ] Google Calendar API calls validate/sanitize external data
- [ ] Environment variables accessed only server-side (`process.env`)
- [ ] No secrets in client bundles (check `NEXT_PUBLIC_` prefix usage)
- [ ] CSRF protection via server actions (built-in to Next.js)

---

## 11. Performance

- [ ] No N+1 queries — batch Supabase reads where possible
- [ ] Large lists are paginated or virtualized
- [ ] Images use `next/image` with proper `width`/`height`
- [ ] Heavy components are lazy-loaded (`dynamic()` or `React.lazy`)
- [ ] No unnecessary re-renders (React DevTools Profiler check)
- [ ] `revalidatePath` / `revalidateTag` used after mutations (not full page reloads)
- [ ] Recharts components don't re-render on every parent update

---

## 12. Error Handling

- [ ] Server actions return `{ error: string }` or throw — never silently fail
- [ ] Toast notifications shown for user-facing errors
- [ ] Network failures handled gracefully (offline-friendly where possible)
- [ ] `console.error` used for unexpected errors (not `console.log`)
- [ ] Error boundaries catch rendering failures in each route group

---

## 13. Accessibility (a11y)

- [ ] Interactive elements are focusable and keyboard-navigable
- [ ] Buttons have accessible labels (text or `aria-label`)
- [ ] Form inputs have associated `<label>` elements
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] `lucide-react` icons have `aria-hidden="true"` when decorative
- [ ] Focus management on route transitions and modal open/close

---

## 14. Testing (when applicable)

- [ ] New logic has unit tests (especially Zod schemas, utility functions)
- [ ] Server actions have integration tests with mock Supabase client
- [ ] Tests describe behavior, not implementation details
- [ ] Edge cases covered: empty arrays, null values, expired sessions
- [ ] Tests are deterministic — no time-dependent failures

---

## Review Summary Template

```markdown
## Summary
[What was reviewed and the overall assessment]

## Strengths
🎉 [What was done well]

## Required Changes
🔴 [Must fix before merge]

## Suggestions
💡 [Nice-to-have improvements]

## Questions
❓ [Clarifications needed]

## Verdict
✅ Approve | 💬 Comment | 🔄 Request Changes
```
