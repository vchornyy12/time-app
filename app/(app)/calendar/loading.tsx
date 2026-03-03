export default function CalendarLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-28 rounded-xl" />
          <div className="skeleton h-4 w-56 rounded-lg" />
        </div>
      </div>

      {/* Today group */}
      <div className="mb-7">
        <div className="skeleton h-3 w-12 rounded mb-3" />
        <div className="flex flex-col gap-2">
          {[70, 55].map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.07]"
            >
              <div className="skeleton h-3 w-14 rounded flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="skeleton h-4 rounded" style={{ width: `${w}%` }} />
                <div className="skeleton h-3 w-16 rounded mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Future group */}
      <div>
        <div className="skeleton h-3 w-32 rounded mb-3" />
        <div className="flex flex-col gap-2">
          {[65, 80, 50].map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.07]"
            >
              <div className="skeleton h-3 w-14 rounded flex-shrink-0 mt-0.5" />
              <div className="skeleton h-4 rounded" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
