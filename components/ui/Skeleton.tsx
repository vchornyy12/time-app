import { cn } from '@/lib/utils/cn'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}

export function TaskSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--glass-panel-border)' }}>
      <Skeleton className="w-4 h-4 rounded-full flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  )
}

export function TaskListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading tasks">
      {Array.from({ length: count }).map((_, i) => (
        <TaskSkeleton key={i} />
      ))}
    </div>
  )
}
