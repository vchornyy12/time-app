'use client'

import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDeleteModalProps {
  open: boolean
  taskTitle: string
  /** When true, shows "Delete permanently" messaging; otherwise "Move to Trash" */
  isPermanent?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeleteModal({
  open,
  taskTitle,
  isPermanent = false,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  const displayTitle = taskTitle.length > 60 ? taskTitle.slice(0, 60) + '…' : taskTitle

  return (
    <Modal open={open} onClose={onCancel}>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isPermanent ? 'Delete permanently?' : 'Move to Trash?'}
          </p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              &ldquo;{displayTitle}&rdquo;
            </span>{' '}
            {isPermanent
              ? 'will be permanently deleted and cannot be recovered.'
              : 'will be moved to Trash. You can restore it from there.'}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {isPermanent ? 'Delete forever' : 'Move to Trash'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
