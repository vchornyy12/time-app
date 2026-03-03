/**
 * Merges class names, filtering out falsy values.
 * Simple alternative to clsx + tailwind-merge for this project.
 */
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}
