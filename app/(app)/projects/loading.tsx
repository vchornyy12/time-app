export default function ProjectsLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-28 rounded-xl" />
          <div className="skeleton h-4 w-60 rounded-lg" />
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {[80, 56, 72, 64].map((w, i) => (
          <li
            key={i}
            className="px-5 py-4 rounded-xl bg-white/[0.04] border border-white/[0.07]"
          >
            <div className="skeleton h-4 rounded-lg mb-2.5" style={{ width: `${w}%` }} />
            <div className="skeleton h-3 w-3/4 rounded-lg mb-3" />
            <div className="skeleton h-3 w-2/5 rounded-lg" />
          </li>
        ))}
      </ul>
    </div>
  )
}
