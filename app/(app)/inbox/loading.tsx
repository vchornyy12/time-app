import { TaskListSkeleton } from '@/components/ui'

export default function InboxLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div className="skeleton h-8 w-24 rounded-xl" />
      </div>
      <TaskListSkeleton count={6} />
    </div>
  )
}
