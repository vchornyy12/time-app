# Landing Page Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 5 mobile layout problems on the landing page so it looks polished on screens 320px–768px wide.

**Architecture:** All changes are CSS-only Tailwind class edits inside `components/marketing/LandingPage.tsx`. No new files, no logic changes. Each task targets one section.

**Tech Stack:** Next.js 16, Tailwind CSS v4, framer-motion

---

## Audit summary — what's broken on mobile

| Section | Issue |
|---|---|
| All sections | `py-20` section padding is excessive on mobile (~80px × 10 sections = 800px of dead space) |
| Comparison table | Long feature text + 4 columns overflows even with `overflow-x-auto` |
| Differentiators | `p-8` card padding is too generous on small screens |
| Final CTA | `px-8 py-14` inner card padding is too large on mobile |
| Footer | Links row (`flex items-center gap-6`) doesn't wrap — copyright + 2 links overflow on narrow screens |

---

## Files

- Modify: `components/marketing/LandingPage.tsx`

---

### Task 1: Reduce section vertical padding for mobile

All `<section>` tags use `py-20` or `py-20 lg:py-28`. Change them to `py-12 sm:py-20` (and `py-12 sm:py-20 lg:py-28` for the hero).

- [ ] **Step 1: Update HeroSection padding**

In `HeroSection`, change:
```tsx
// Before
<section className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
// After
<section className="max-w-6xl mx-auto px-6 py-12 sm:py-20 lg:py-28">
```

- [ ] **Step 2: Update all other section padding (5 sections)**

Make this replacement across `PainPointSection`, `GTDWorkflowSection`, `FeaturesSection`, `DifferentiatorsSection`, `ComparisonTable`, `FeatureChecklistSection`, `TestimonialsSection`, `TrustBanner`, `FAQSection`, `FinalCTASection`:

Each one has `py-20 border-t border-white/10` or just `py-20`. Change all to `py-12 sm:py-20`:

```tsx
// PainPointSection, GTDWorkflowSection, FeaturesSection, DifferentiatorsSection,
// ComparisonTable, FeatureChecklistSection, TestimonialsSection, TrustBanner,
// FAQSection, FinalCTASection — each:
// Before: "max-w-6xl mx-auto px-6 py-20 border-t border-white/10"
// After:  "max-w-6xl mx-auto px-6 py-12 sm:py-20 border-t border-white/10"
```

Also update `StatsBar` which uses `py-6` — leave that one as-is (it's already compact).

- [ ] **Step 3: Commit**

```bash
git add components/marketing/LandingPage.tsx
git commit -m "fix(landing): reduce section padding on mobile (py-12 sm:py-20)"
```

---

### Task 2: Fix comparison table on mobile

The table has 4 columns with long feature text. On mobile replace it with a card-based list showing only the time24 column.

- [ ] **Step 1: Add mobile card view inside `ComparisonTable`**

Replace the inner content of `FadeUp delay={0.1}` in `ComparisonTable`:

```tsx
<FadeUp delay={0.1}>
  {/* Mobile: card list (time24 column only) */}
  <div className="sm:hidden flex flex-col divide-y divide-white/10 rounded-xl border border-white/10 overflow-hidden">
    {comparisonRows.map((row) => (
      <div key={row.feature} className="flex items-start justify-between gap-3 px-4 py-3 bg-[#1c1c1c]">
        <span className="text-xs text-zinc-300 leading-snug flex-1">{row.feature}</span>
        <span className="shrink-0 text-sm font-medium">
          <CellValue value={row.time24} />
        </span>
      </div>
    ))}
  </div>

  {/* Desktop: full comparison table */}
  <div className="hidden sm:block overflow-x-auto">
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className="text-left py-3 pr-6 text-zinc-400 font-normal" />
          <th className="text-center py-3 px-4 text-[#3ECF8E] font-bold">time24</th>
          <th className="text-center py-3 px-4 text-zinc-400 font-normal">Todoist</th>
          <th className="text-center py-3 px-4 text-zinc-400 font-normal">Things 3</th>
        </tr>
      </thead>
      <tbody>
        {comparisonRows.map((row) => (
          <tr key={row.feature} className="border-t border-white/10">
            <td className="text-zinc-300 py-3 pr-6">{row.feature}</td>
            <td className="text-center py-3 px-4 bg-[#3ECF8E]/[0.04]">
              <CellValue value={row.time24} />
            </td>
            <td className="text-center py-3 px-4">
              <CellValue value={row.todoist} />
            </td>
            <td className="text-center py-3 px-4">
              <CellValue value={row.things3} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</FadeUp>
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/LandingPage.tsx
git commit -m "fix(landing): replace comparison table with card list on mobile"
```

---

### Task 3: Reduce Differentiators card padding on mobile

The two differentiator cards use `p-8` which is 2rem on all sides — too tight on small screens.

- [ ] **Step 1: Update both differentiator card padding**

In `DifferentiatorsSection`, find both `motion.div` cards (Clarity Protocol and Success Diary). Each has `className="relative p-8 rounded-xl border..."`. Change:

```tsx
// Before (both cards):
className="relative p-8 rounded-xl border border-[#3ECF8E]/20 ..."
// After (both cards):
className="relative p-5 sm:p-8 rounded-xl border border-[#3ECF8E]/20 ..."
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/LandingPage.tsx
git commit -m "fix(landing): reduce differentiator card padding on mobile"
```

---

### Task 4: Reduce Final CTA inner card padding on mobile

The CTA card uses `px-8 py-14` on all screen sizes.

- [ ] **Step 1: Update CTA card padding**

In `FinalCTASection`, find:
```tsx
// Before:
className="relative rounded-2xl bg-[#1c1c1c] border border-white/10 px-8 py-14 flex flex-col items-center gap-6 text-center overflow-hidden"
// After:
className="relative rounded-2xl bg-[#1c1c1c] border border-white/10 px-5 py-10 sm:px-8 sm:py-14 flex flex-col items-center gap-6 text-center overflow-hidden"
```

- [ ] **Step 2: Commit**

```bash
git add components/marketing/LandingPage.tsx
git commit -m "fix(landing): reduce CTA card padding on mobile"
```

---

### Task 5: Fix footer links overflow on mobile

The footer links row (`flex items-center gap-6`) won't wrap. On narrow screens the copyright text + 2 links overflow.

- [ ] **Step 1: Update footer links row**

In `LandingFooter`, find the inner links `div`:
```tsx
// Before:
<div className="flex items-center gap-6">
  <Link href="/privacy" ...>Privacy Policy</Link>
  <Link href="/terms" ...>Terms of Service</Link>
  <p className="text-xs text-zinc-300">...</p>
</div>
// After:
<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
  <Link href="/privacy" ...>Privacy Policy</Link>
  <Link href="/terms" ...>Terms of Service</Link>
  <p className="text-xs text-zinc-300">...</p>
</div>
```

- [ ] **Step 2: Verify on mobile by running dev server and viewing at 375px width**

```bash
npm run dev
# Open http://localhost:3000 in browser DevTools → iPhone SE (375×667)
# Verify: footer links stack cleanly, no overflow
# Verify: comparison table shows card list below sm breakpoint
# Verify: section spacing feels balanced
```

- [ ] **Step 3: Commit**

```bash
git add components/marketing/LandingPage.tsx
git commit -m "fix(landing): make footer links wrappable on narrow screens"
```
