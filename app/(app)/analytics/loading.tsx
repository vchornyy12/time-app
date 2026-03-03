export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-6 w-28 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="h-4 w-44 bg-white/[0.04] rounded-lg animate-pulse" />
        </div>
        <div className="h-9 w-48 bg-white/[0.04] rounded-xl animate-pulse" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-4 flex flex-col gap-2">
            <div className="h-3 w-20 bg-white/[0.05] rounded animate-pulse" />
            <div className="h-7 w-12 bg-white/[0.07] rounded animate-pulse" />
            <div className="h-3 w-24 bg-white/[0.04] rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="glass-card p-5">
        <div className="h-4 w-36 bg-white/[0.05] rounded animate-pulse mb-4" />
        <div className="h-48 bg-white/[0.03] rounded-lg animate-pulse" />
      </div>

      {/* Bottom row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass-card p-5">
            <div className="h-4 w-32 bg-white/[0.05] rounded animate-pulse mb-4" />
            <div className="h-40 bg-white/[0.03] rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
