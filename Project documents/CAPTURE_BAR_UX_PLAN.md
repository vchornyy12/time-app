# Capture Bar UX Improvements — Implementation Plan

**Date**: 2026-03-20
**Scope**: 5 user stories targeting `QuickCaptureBar`, `AppLayout`, `InboxItem`, and `TaskCard`

---

## Story 1 — Auto-expanding input

> *As a user, I want the task entry window to expand automatically when I enter a lot of text.*

### Current state
`QuickCaptureBar` uses `<input type="text">` — single-line, text overflows invisibly.

### Approach
Replace the `<input>` with a `<textarea>` that grows to fit its content.

**Files**: `components/layout/QuickCaptureBar.tsx`

**Steps**:

1. Change `inputRef` type from `useRef<HTMLInputElement>` to `useRef<HTMLTextAreaElement>`.

2. Replace `<input type="text" … />` with:
   ```tsx
   <textarea
     ref={inputRef}
     rows={1}
     value={value}
     onChange={(e) => {
       setValue(e.target.value.slice(0, MAX_CHARS))
       autoResize(e.target)
     }}
     onKeyDown={handleKeyDown}
     onFocus={() => setIsFocused(true)}
     onBlur={() => setIsFocused(false)}
     placeholder="Capture anything…"
     className="flex-1 bg-transparent outline-none text-sm min-w-0 resize-none overflow-hidden leading-snug"
     style={{ color: 'var(--text-primary)' }}
     aria-label="Quick capture — press Enter to add"
     disabled={isPending}
   />
   ```

3. Add the `autoResize` helper:
   ```ts
   function autoResize(el: HTMLTextAreaElement) {
     el.style.height = 'auto'
     el.style.height = `${el.scrollHeight}px`
   }
   ```

4. Add a `useEffect` to reset height to `auto` (1 row) when `value` is cleared after submit:
   ```ts
   useEffect(() => {
     if (value === '' && inputRef.current) {
       inputRef.current.style.height = 'auto'
     }
   }, [value])
   ```

5. Update `handleKeyDown` — keep `Enter` to submit, `Shift+Enter` to insert a newline:
   ```ts
   function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
     if (e.key === 'Enter' && !e.shiftKey) {
       e.preventDefault()
       handleCapture()
     }
     if (e.key === 'Escape') {
       setValue('')
       setStagedFiles([])
       inputRef.current?.blur()
     }
   }
   ```

---

## Story 2 — Re-focus after save

> *As a user, I want the entry window to become active again (with the cursor inside it) after I've entered and saved a task.*

### Current state
`inputRef.current?.focus()` is already called at line 135 after a successful capture. This works correctly and will continue to work after the textarea migration.

**No code change needed.** The `focus()` call is already in place; Story 1's textarea migration preserves it automatically.

---

## Story 3 — Dim background while entering

> *As a user, I want the background displaying saved tasks to dim whilst I'm entering a task.*

### Approach
Lift the `isFocused` state to `AppLayout` via a callback prop, then render a semi-transparent overlay over the `<main>` content area.

**Files**: `components/layout/QuickCaptureBar.tsx`, `components/layout/AppLayout.tsx`

**Steps**:

1. **`AppLayout.tsx`** — add `isCaptureFocused` state and pass a setter down:
   ```tsx
   const [isCaptureFocused, setIsCaptureFocused] = useState(false)
   ```
   In the main area JSX, add the overlay immediately before `<QuickCaptureBar>`:
   ```tsx
   {/* Dim overlay — active while capture bar is focused */}
   <div
     aria-hidden="true"
     className="fixed inset-0 md:left-[248px] pointer-events-none z-10 transition-opacity duration-300"
     style={{ background: 'rgba(0,0,0,0.35)', opacity: isCaptureFocused ? 1 : 0 }}
   />
   <QuickCaptureBar onFocusChange={setIsCaptureFocused} />
   ```
   The overlay sits at `z-10`; the capture bar is at `z-20`, so the bar stays above the dim.

2. **`QuickCaptureBar.tsx`** — add the `onFocusChange` prop and call it when focus changes:
   ```ts
   interface QuickCaptureBarProps {
     onFocusChange?: (focused: boolean) => void
   }
   export function QuickCaptureBar({ onFocusChange }: QuickCaptureBarProps) {
   ```
   In the `onFocus` / `onBlur` handlers of the textarea:
   ```ts
   onFocus={() => { setIsFocused(true); onFocusChange?.(true) }}
   onBlur={() => { setIsFocused(false); onFocusChange?.(false) }}
   ```

---

## Story 4 — Tooltip for truncated task titles

> *I want a tooltip to appear showing the full text of the task whenever I hover the cursor over a task and the text is too long to fit in the task window.*

### Affected components
- `InboxItem` — title button already uses `truncate`
- `TaskCard` — title button currently wraps (no truncation); add single-line truncation

### Approach
Use a small `useOverflowing` hook that checks `scrollWidth > clientWidth` after mount and on resize. Set `title={task.title}` on the element only when it is overflowing (browser native tooltip — no extra dependency).

**New file**: `lib/hooks/useOverflowing.ts`
```ts
import { useRef, useState, useEffect } from 'react'

export function useOverflowing<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    function check() {
      const el = ref.current
      if (el) setIsOverflowing(el.scrollWidth > el.clientWidth)
    }
    check()
    const observer = new ResizeObserver(check)
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return { ref, isOverflowing }
}
```

**`InboxItem.tsx`** — apply to the title button:
```tsx
const { ref: titleRef, isOverflowing } = useOverflowing<HTMLButtonElement>()

<button
  ref={titleRef}
  type="button"
  onClick={handleTitleClick}
  title={isOverflowing ? task.title : undefined}
  className="text-base leading-snug text-left hover:text-indigo-300 transition-colors duration-150 cursor-pointer w-full truncate"
  style={{ color: 'var(--text-primary)' }}
>
  {task.title}
</button>
```

**`TaskCard.tsx`** — add `truncate` to the title button and apply the hook:
```tsx
const { ref: titleRef, isOverflowing } = useOverflowing<HTMLButtonElement>()

<button
  ref={titleRef}
  type="button"
  onClick={onTitleClick}
  title={isOverflowing ? task.title : undefined}
  className="text-base leading-snug text-left hover:text-[var(--accent)] transition-colors duration-150 cursor-pointer w-full truncate"
  style={{ color: 'var(--text-primary)' }}
>
  {task.title}
</button>
```

> Note: `TaskCard` titles will now truncate. If the detail overlay already shows the full title, this is a net improvement. Verify that `TaskDetailPanel` still shows the full text.

---

## Story 5 — Green highlight + underline on capture bar

> *As a user, I want the task input window to be highlighted and underlined in green, brighter when it is active and darker when it is inactive.*

### Approach
Update the `--capture-border` / `--capture-border-focus` CSS variables to use green, and add a dedicated bottom-border underline as a visual accent. Both light and dark theme values need updating.

**Files**: `app/globals.css`, `components/layout/QuickCaptureBar.tsx`

**Step 1 — Update CSS variables** in `globals.css` (both `:root` light block and `.dark` block):

*Light theme (`:root`):*
```css
--capture-border:       rgba(62, 207, 142, 0.35);   /* dim green when inactive */
--capture-border-focus: rgba(62, 207, 142, 0.90);   /* bright green when active */
--capture-shadow:       0 1px 3px rgba(62, 207, 142, 0.08);
--capture-shadow-focus: 0 2px 10px rgba(62, 207, 142, 0.25);
```

*Dark theme (`.dark`):*
```css
--capture-border:       rgba(62, 207, 142, 0.25);
--capture-border-focus: rgba(62, 207, 142, 0.80);
--capture-shadow:       0 1px 3px rgba(0, 0, 0, 0.40);
--capture-shadow-focus: 0 2px 14px rgba(62, 207, 142, 0.20);
```

**Step 2 — Add underline accent** in `QuickCaptureBar.tsx`.
Inside the wrapper `<div>`, replace the current `style` border with a combined border + bottom accent line. Add an absolutely positioned bottom bar:

```tsx
{/* Green underline accent */}
<div
  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-lg transition-all duration-200"
  style={{
    background: isFocused || dragOver
      ? 'var(--accent)'               // bright #3ECF8E
      : 'rgba(62, 207, 142, 0.35)',   // dim green
  }}
/>
```

Make the outer `<div>` `relative` to contain the absolute underline:
```tsx
className={cn(
  'relative pointer-events-auto w-full max-w-2xl mx-4',
  'flex flex-col',
  'rounded-lg',
  'transition-all duration-200',
)}
```

The existing `border` inline style already picks up the updated `--capture-border` / `--capture-border-focus` variables, so the full border turns green automatically — the bottom accent line provides the stronger underline emphasis the story asks for.

---

## Implementation order

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 1 | Add `useOverflowing` hook | `lib/hooks/useOverflowing.ts` | XS |
| 2 | Apply tooltip to `InboxItem` | `components/tasks/InboxItem.tsx` | XS |
| 3 | Apply tooltip + truncate to `TaskCard` | `components/tasks/TaskCard.tsx` | XS |
| 4 | Update CSS variables to green | `app/globals.css` | XS |
| 5 | Add green underline accent to capture bar | `components/layout/QuickCaptureBar.tsx` | S |
| 6 | Migrate `<input>` → auto-resize `<textarea>` | `components/layout/QuickCaptureBar.tsx` | S |
| 7 | Add `onFocusChange` prop to `QuickCaptureBar` | `components/layout/QuickCaptureBar.tsx` | XS |
| 8 | Add dim overlay to `AppLayout` | `components/layout/AppLayout.tsx` | S |

Recommended to do steps 1–5 first (purely visual, no state changes) and verify in the browser, then 6–8 (structural changes with overlay).

---

## Edge cases & notes

- **Textarea height on Escape/submit**: Reset `style.height = 'auto'` in both clear paths (`Escape` key handler and after successful save) to snap back to single-row.
- **Dim overlay + mobile nav**: The `md:left-[248px]` offset on the dim overlay matches the sidebar width; on mobile (`< md`) set to `left-0` so the full viewport dims. The `MobileNav` sits at `z-30` — verify it renders above the dim overlay.
- **Tooltip and double-click edit**: `InboxItem` title uses both a tooltip and a double-click edit handler. The native `title` tooltip will not conflict with double-click editing.
- **TaskCard detail overlay**: After adding `truncate` to `TaskCard` titles, confirm `TaskDetailPanel` / `TaskDetailOverlay` still renders the full, unwrapped title.
- **`useOverflowing` and SSR**: The hook uses `ResizeObserver` which is browser-only. It is only used in `'use client'` components, so no SSR issue.
