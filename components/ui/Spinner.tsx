import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type Size = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: Size
  className?: string
}

const sizeClasses: Record<Size, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin', sizeClasses[size], className)}
      style={{ color: 'var(--text-tertiary)' }}
      aria-label="Loading"
    />
  )
}

/** Full-area centred loading state */
export function PageSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[200px]">
      <Spinner size="lg" />
    </div>
  )
}
