'use client'

import { useState, useRef, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, SpinnerGap } from '@phosphor-icons/react'
import { Paperclip, X, Image, FileText, Film, Music, File } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { captureTask } from '@/lib/actions/tasks'
import { updateTaskAttachments } from '@/lib/actions/attachments'
import { createClient } from '@/lib/supabase/client'
import { Toast } from '@/components/ui'
import type { Attachment } from '@/lib/types'

const MAX_CHARS = 500
const MAX_FILE_SIZE = 10 * 1024 * 1024

function getFileIcon(type: string) {
  const cls = 'w-3.5 h-3.5'
  if (type.startsWith('image/')) return <Image className={cls} />
  if (type.startsWith('video/')) return <Film className={cls} />
  if (type.startsWith('audio/')) return <Music className={cls} />
  if (type.includes('pdf') || type.includes('document') || type.includes('text'))
    return <FileText className={cls} />
  return <File className={cls} />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function QuickCaptureBar() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const charsLeft = MAX_CHARS - value.length
  const nearLimit = charsLeft <= 50
  const hasFiles = stagedFiles.length > 0

  const addFiles = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        setErrorMessage(`"${f.name}" exceeds 10 MB limit`)
        return false
      }
      return true
    })
    setStagedFiles((prev) => {
      const total = [...prev, ...valid].slice(0, 20)
      return total
    })
  }, [])

  const removeFile = useCallback((index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Paste handler for screenshots
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (!barRef.current?.contains(document.activeElement)) return

      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const ext = file.type.split('/')[1] || 'png'
            imageFiles.push(
              new File([file], `screenshot-${Date.now()}.${ext}`, { type: file.type })
            )
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        addFiles(imageFiles)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [addFiles])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCapture()
    }
    if (e.key === 'Escape') {
      setValue('')
      setStagedFiles([])
      inputRef.current?.blur()
    }
  }

  function handleCapture() {
    const trimmed = value.trim()
    if (!trimmed || isPending) return

    startTransition(async () => {
      try {
        const { id: taskId } = await captureTask(trimmed)

        if (stagedFiles.length > 0) {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const attachments: Attachment[] = []

            for (const file of stagedFiles) {
              const filePath = `${user.id}/${taskId}/${Date.now()}-${file.name}`
              const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(filePath, file, { upsert: false })

              if (!uploadError) {
                attachments.push({
                  name: file.name,
                  path: filePath,
                  type: file.type || 'application/octet-stream',
                  size: file.size,
                })
              }
            }

            if (attachments.length > 0) {
              await updateTaskAttachments(taskId, attachments)
            }
          }
        }

        setValue('')
        setStagedFiles([])
        router.refresh()
        inputRef.current?.focus()
      } catch {
        setErrorMessage('Failed to capture task. Please try again.')
      }
    })
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 md:left-[248px] z-20 flex justify-center pointer-events-none pb-8 mb-14 md:mb-0">
        <div
          ref={barRef}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
          }}
          className={cn(
            'pointer-events-auto w-full max-w-2xl mx-4',
            'flex flex-col',
            'rounded-2xl',
            'backdrop-blur-[12px]',
            'transition-all duration-200',
            dragOver && 'border-indigo-400/40',
          )}
          style={{
            background: (isFocused || dragOver) ? 'var(--capture-bg-focus)' : 'var(--capture-bg)',
            border: `1px solid ${(isFocused || dragOver) ? 'var(--capture-border-focus)' : 'var(--capture-border)'}`,
            boxShadow: (isFocused || dragOver) ? 'var(--capture-shadow-focus)' : 'var(--capture-shadow)',
          }}
        >
          {/* Main input row */}
          <div className="flex items-center gap-3 px-5 py-3">
            {isPending ? (
              <SpinnerGap size={18} weight="bold" className="text-indigo-400 animate-spin flex-shrink-0" />
            ) : (
              <Plus
                size={18}
                weight="light"
                className="flex-shrink-0 transition-colors duration-150"
                style={{ color: isFocused ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              />
            )}

            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Capture anything…"
              className="flex-1 bg-transparent outline-none text-sm min-w-0"
              style={{ color: 'var(--text-primary)', '--tw-placeholder-opacity': '1' } as React.CSSProperties}
              aria-label="Quick capture — press Enter to add"
              disabled={isPending}
            />

            {/* Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg transition-all duration-150 flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Attach files"
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files)
                e.target.value = ''
              }}
            />

            {value.length > 0 && (
              <span
                className={cn(
                  'text-xs flex-shrink-0 tabular-nums transition-colors duration-150',
                  nearLimit ? 'text-yellow-400' : ''
                )}
                style={!nearLimit ? { color: 'var(--text-muted)' } : undefined}
                aria-live="polite"
                aria-label={`${charsLeft} characters remaining`}
              >
                {charsLeft}
              </span>
            )}
          </div>

          {/* Staged files preview */}
          {hasFiles && (
            <div className="px-5 pb-3 flex flex-wrap gap-2">
              {stagedFiles.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs max-w-[200px]"
                  style={{
                    background: 'var(--chip-bg)',
                    border: '1px solid var(--chip-border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {getFileIcon(file.type)}
                  </span>
                  <span className="truncate">{file.name}</span>
                  <span className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="flex-shrink-0 p-0.5 rounded transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Drop hint when dragging */}
          {dragOver && (
            <div className="px-5 pb-3">
              <p className="text-xs text-indigo-300/60 text-center">Drop files to attach</p>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <Toast
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}
    </>
  )
}
