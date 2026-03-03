import { TaskListSkeleton } from '@/components/ui'

export default function SomedayLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-44 rounded-xl" />
          <div className="skeleton h-4 w-56 rounded-lg" />
        </div>
      </div>
      <TaskListSkeleton count={5} />
    </div>
  )
}
