export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="skeleton h-8 w-28 rounded-xl" />
        <div className="skeleton h-4 w-64 rounded-lg mt-2" />
      </div>
      <div className="skeleton h-3 w-24 rounded mb-3" />
      <div className="px-5 py-5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="skeleton h-4 w-36 rounded" />
            <div className="skeleton h-3 w-56 rounded" />
          </div>
          <div className="skeleton h-6 w-24 rounded-full" />
        </div>
        <div className="skeleton h-9 w-44 rounded-xl mt-4" />
      </div>
    </div>
  )
}
