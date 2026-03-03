import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function ProjectNotFound() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="text-5xl opacity-30 select-none">📁</div>
      <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Project not found</h2>
      <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        This project doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 mt-2 text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Projects
      </Link>
    </div>
  )
}
