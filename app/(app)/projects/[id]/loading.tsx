export default function ProjectDetailLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link skeleton */}
      <div className="skeleton h-4 w-20 rounded-lg mb-6" />

      {/* Title */}
      <div className="mb-8">
        <div className="skeleton h-8 w-2/3 rounded-xl" />
      </div>

      {/* Criteria card */}
      <div className="px-5 py-4 rounded-xl bg-white/[0.04] border border-white/[0.07] mb-8">
        <div className="skeleton h-3 w-16 rounded mb-2" />
        <div className="skeleton h-4 w-full rounded mb-1.5" />
        <div className="skeleton h-4 w-3/4 rounded" />
      </div>

      {/* Active step */}
      <div className="mb-8">
        <div className="skeleton h-3 w-28 rounded mb-3" />
        <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white/[0.04] border border-white/[0.07]">
          <div className="skeleton w-5 h-5 rounded-full flex-shrink-0" />
          <div className="skeleton h-4 w-2/3 rounded" />
        </div>
      </div>

      {/* Rough plan */}
      <div>
        <div className="skeleton h-3 w-24 rounded mb-3" />
        <div className="flex flex-col gap-2">
          {[60, 75, 50, 65].map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <div className="skeleton h-3 w-4 rounded" />
              <div className="skeleton h-3 rounded" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
