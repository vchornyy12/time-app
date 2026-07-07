# Mobile APK CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native Android early-access download section to the landing page that renders only when `NEXT_PUBLIC_APK_URL` is set.

**Architecture:** All changes are confined to `components/marketing/LandingPage.tsx`. A new `MobileAppSection` component is added following the existing inline-component pattern (dark card, Framer Motion animations, green accent). It short-circuits to `null` when `NEXT_PUBLIC_APK_URL` is empty. The FAQ answer for the mobile question is updated to mention the APK. One env var is added to `.env.local`.

**Tech Stack:** Next.js 16, React, Framer Motion, Lucide React, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `components/marketing/LandingPage.tsx` | Add `Smartphone` import, add `MobileAppSection` component, insert it between `FAQSection` and `FinalCTASection` in `LandingPage`, update FAQ answer |
| `.env.local` | Add `NEXT_PUBLIC_APK_URL=` |

---

### Task 1: Add the env var

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add the env var placeholder**

Open `.env.local` at the repo root and append:

```
NEXT_PUBLIC_APK_URL=
```

Leave the value empty for now — the section will not render until a URL is added.

- [ ] **Step 2: Commit**

```bash
git add .env.local
git commit -m "chore: add NEXT_PUBLIC_APK_URL env var placeholder"
```

---

### Task 2: Add `Smartphone` to the Lucide import

**Files:**
- Modify: `components/marketing/LandingPage.tsx` (line 6 — the lucide-react import)

- [ ] **Step 1: Add `Smartphone` to the existing import**

The current import on line 6 is:
```tsx
import {
  Zap, Brain, Target, Lock, ShieldCheck, Database, Globe,
  BookOpen, Sparkles, CalendarCheck, Layers,
  Calendar, Lightbulb, CheckCircle2, AlertTriangle, CheckCheck,
  Inbox, ChevronDown,
} from 'lucide-react'
```

Replace it with:
```tsx
import {
  Zap, Brain, Target, Lock, ShieldCheck, Database, Globe,
  BookOpen, Sparkles, CalendarCheck, Layers,
  Calendar, Lightbulb, CheckCircle2, AlertTriangle, CheckCheck,
  Inbox, ChevronDown, Smartphone,
} from 'lucide-react'
```

- [ ] **Step 2: Verify no lint errors**

```bash
npm run lint
```

Expected: no errors.

---

### Task 3: Add `MobileAppSection` component

**Files:**
- Modify: `components/marketing/LandingPage.tsx` (insert after the `FAQSection` function, before the `FinalCTASection` function — around line 1122)

- [ ] **Step 1: Add the APK URL constant near the top of the file**

Directly below the last `import` statement (after line 15), add:

```tsx
const APK_URL = process.env.NEXT_PUBLIC_APK_URL
```

- [ ] **Step 2: Add the `MobileAppSection` component**

Insert the following block between the closing `}` of `FAQSection` and the `// ─── Final CTA` comment (around line 1122):

```tsx
// ─── Mobile App ──────────────────────────────────────────────────────────────

function MobileAppSection() {
  if (!APK_URL) return null

  return (
    <section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10">
      <FadeUp>
        <div className="relative max-w-2xl mx-auto rounded-2xl bg-[#1c1c1c] border border-white/10 px-5 py-10 sm:px-8 sm:py-12 flex flex-col items-center gap-6 text-center overflow-hidden">
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              background: [
                'radial-gradient(ellipse at 50% 130%, #3ECF8E14 0%, transparent 60%)',
                'radial-gradient(ellipse at 50% 90%, #3ECF8E20 0%, transparent 60%)',
                'radial-gradient(ellipse at 50% 130%, #3ECF8E14 0%, transparent 60%)',
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="relative z-10 w-14 h-14 rounded-2xl bg-[#3ECF8E]/10 flex items-center justify-center">
            <Smartphone size={28} className="text-[#3ECF8E]" />
          </div>
          <div className="relative z-10 flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#3ECF8E]">
              Android App · Early Access
            </span>
            <h2 className="text-3xl font-bold text-zinc-100">Take time24 with you</h2>
            <p className="text-zinc-300 max-w-md">
              The native Android app is in early access. Install the APK and try it before it
              hits the Play Store.
            </p>
          </div>
          <div className="relative z-10 flex flex-col items-center gap-3">
            <motion.a
              href={APK_URL}
              download
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.96 }}
              className="px-8 py-3 rounded-lg bg-[#3ECF8E] text-black font-semibold text-sm hover:bg-[#34B27B] transition-colors"
            >
              Download APK
            </motion.a>
            <p className="text-xs text-zinc-500">
              Android 8.0+ · Enable &ldquo;Install from unknown sources&rdquo; in Settings
            </p>
          </div>
          <p className="relative z-10 text-xs text-zinc-600">iOS coming soon</p>
        </div>
      </FadeUp>
    </section>
  )
}
```

- [ ] **Step 3: Verify no lint errors**

```bash
npm run lint
```

Expected: no errors.

---

### Task 4: Wire `MobileAppSection` into the page and update the FAQ

**Files:**
- Modify: `components/marketing/LandingPage.tsx`

- [ ] **Step 1: Insert `MobileAppSection` between `FAQSection` and `FinalCTASection`**

Find the `LandingPage` function (around line 1209). The current `<main>` block ends with:

```tsx
        <FAQSection />
        <FinalCTASection />
```

Replace with:

```tsx
        <FAQSection />
        <MobileAppSection />
        <FinalCTASection />
```

- [ ] **Step 2: Update the FAQ answer for the mobile question**

Find the `faqs` array entry (around line 1059):

```tsx
  {
    q: 'Is there a mobile app?',
    a: 'time24 is fully mobile-responsive and works in any browser on iOS and Android. A native iOS and Android app is currently in development — sign up to get notified when it launches.',
  },
```

Replace with:

```tsx
  {
    q: 'Is there a mobile app?',
    a: 'time24 is fully mobile-responsive and works in any browser on iOS and Android. An early-access Android APK is available — scroll down to the Android section on this page to download it. iOS is coming soon.',
  },
```

- [ ] **Step 3: Verify no lint errors**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/LandingPage.tsx
git commit -m "feat(landing): add Android early-access APK download section"
```

---

### Task 5: Verify in the browser

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:3000`.

- [ ] **Step 2: Verify section is hidden without URL**

With `NEXT_PUBLIC_APK_URL=` (empty) in `.env.local`, confirm no Android section appears between the FAQ and the final CTA. The page should look identical to before.

- [ ] **Step 3: Set a test URL and verify section renders**

In `.env.local`, set:

```
NEXT_PUBLIC_APK_URL=https://example.com/time24.apk
```

Restart the dev server (`npm run dev`). Confirm:
- The "Take time24 with you" section appears between FAQ and "Start clearing your head today"
- The "Download APK" button is present and green
- The disclaimer text and "iOS coming soon" footnote are visible
- Hovering the button shows the scale animation
- Clicking the button triggers a download (or navigates to the URL)
- On mobile viewport (375px), the card looks correct — no overflow

- [ ] **Step 4: Reset the URL**

Revert `.env.local` back to `NEXT_PUBLIC_APK_URL=` (empty) until the real APK is uploaded to Supabase Storage.
