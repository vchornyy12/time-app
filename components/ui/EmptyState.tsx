import { cn } from '@/lib/utils/cn'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-20 text-center',
        className
      )}
    >
      {icon && <div className="text-5xl opacity-30 select-none">{icon}</div>}
      <div className="flex flex-col gap-1">
        <p className="font-medium" style={{ color: 'var(--text-tertiary)' }}>{title}</p>
        {description && (
          <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
