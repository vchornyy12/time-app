export default function WeeklyReviewLoading() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div className="h-9 w-56 bg-white/[0.06] rounded-xl animate-pulse" />
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 flex flex-col gap-4">
        <div className="h-5 w-40 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-4 w-full bg-white/[0.04] rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-10 w-full bg-white/[0.06] rounded-xl animate-pulse mt-2" />
      </div>
    </div>
  )
}
