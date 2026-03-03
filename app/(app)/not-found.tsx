import Link from 'next/link'

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 gap-4 text-center animate-fade-in">
      <div className="text-5xl opacity-30 select-none">🌫️</div>
      <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Page not found</h2>
      <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/inbox"
        className="mt-2 text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
      >
        Go to Inbox
      </Link>
    </div>
  )
}
