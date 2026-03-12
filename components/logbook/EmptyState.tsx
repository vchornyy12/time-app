import { CheckCircle } from '@phosphor-icons/react'

export function LogbookEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <CheckCircle
        size={48}
        weight="thin"
        className="mb-4"
        style={{ color: 'var(--text-muted)' }}
        aria-hidden="true"
      />
      <h3
        className="text-base font-semibold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        Nothing completed yet.
      </h3>
      <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
        Mark your first task done and it will appear here as part of your daily success diary.
      </p>
    </div>
  )
}
