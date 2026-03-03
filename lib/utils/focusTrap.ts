const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/** Returns all visible, focusable elements within a container */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden]') && el.offsetParent !== null
  )
}

/**
 * Sets up a focus trap inside `container`.
 * Returns a cleanup function — call it when the trap should be removed.
 * Pass `onEscape` to handle the Escape key.
 */
export function createFocusTrap(
  container: HTMLElement,
  onEscape?: () => void
): () => void {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onEscape?.()
      return
    }

    if (e.key !== 'Tab') return

    const elements = getFocusableElements(container)
    if (elements.length === 0) return

    const first = elements[0]
    const last = elements[elements.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}
