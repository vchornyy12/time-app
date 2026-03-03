import { cn } from '@/lib/utils/cn'

type BadgeVariant = 'default' | 'indigo' | 'red' | 'yellow' | 'green'

interface BadgeProps {
  children?: React.ReactNode
  /** Numeric count — renders "99+" when above `max`. Pass instead of children for count badges. */
  count?: number
  max?: number
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[var(--chip-bg)] text-[var(--text-secondary)]',
  indigo:  'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300',
  red:     'bg-red-500/20 text-red-500 dark:text-red-300',
  yellow:  'bg-yellow-500/20 text-yellow-600 dark:text-yellow-300',
  green:   'bg-green-500/20 text-green-600 dark:text-green-300',
}

export function Badge({ children, count, max = 99, variant = 'indigo', className }: BadgeProps) {
  const display =
    count !== undefined ? (count === 0 ? null : count > max ? `${max}+` : String(count)) : children

  if (display === null) return null

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5',
        'rounded-full text-xs font-semibold leading-none',
        variantClasses[variant],
        className
      )}
      aria-label={count !== undefined ? `${count} items` : undefined}
    >
      {display}
    </span>
  )
}
