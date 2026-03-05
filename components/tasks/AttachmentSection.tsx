'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Paperclip,
  Upload,
  X,
  FileText,
  Image,
  Film,
  Music,
  File,
  Download,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import {
  updateTaskAttachments,
  deleteAttachment,
  getAttachmentUrls,
} from '@/lib/actions/attachments'
import type { Attachment } from '@/lib/types'

interface AttachmentSectionProps {
  taskId: string
  userId: string
  attachments: Attachment[]
  onAttachmentsChange: (attachments: Attachment[]) => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_ATTACHMENTS = 20

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image className="w-4 h-4" aria-hidden="true" />
  if (type.startsWith('video/')) return <Film className="w-4 h-4" aria-hidden="true" />
  if (type.startsWith('audio/')) return <Music className="w-4 h-4" aria-hidden="true" />
  if (type.includes('pdf') || type.includes('document') || type.includes('text'))
    return <FileText className="w-4 h-4" aria-hidden="true" />
  return <File className="w-4 h-4" aria-hidden="true" />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentSection({
  taskId,
  userId,
  attachments,
  onAttachmentsChange,
}: AttachmentSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch signed URLs when attachments change
  useEffect(() => {
    if (attachments.length === 0) {
      setSignedUrls({})
      return
    }
    let mounted = true
    getAttachmentUrls(taskId).then((urls) => {
      if (!mounted) return
      const map: Record<string, string> = {}
      for (const u of urls) map[u.name] = u.url
      setSignedUrls(map)
    }).catch(() => { })
    return () => { mounted = false }
  }, [taskId, attachments])

  // Accepts the running accumulated list so sequential uploads don't clobber each other.
  const uploadFile = useCallback(
    async (file: File, currentAttachments: Attachment[]): Promise<Attachment[]> => {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds 10 MB limit`)
        return currentAttachments
      }
      if (currentAttachments.length >= MAX_ATTACHMENTS) {
        setError(`Maximum ${MAX_ATTACHMENTS} attachments reached`)
        return currentAttachments
      }

      setError(null)
      setUploading(true)
      setUploadProgress(`Uploading ${file.name}...`)

      try {
        const supabase = createClient()
        const filePath = `${userId}/${taskId}/${Date.now()}-${file.name}`

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file, { upsert: false })

        if (uploadError) throw uploadError

        const newAttachment: Attachment = {
          name: file.name,
          path: filePath,
          type: file.type || 'application/octet-stream',
          size: file.size,
        }

        const updated = [...currentAttachments, newAttachment]
        await updateTaskAttachments(taskId, updated)
        onAttachmentsChange(updated)
        return updated
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Upload failed'
        )
        return currentAttachments
      } finally {
        setUploading(false)
        setUploadProgress(null)
      }
    },
    [taskId, userId, onAttachmentsChange]
  )

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      // Thread accumulated list through the chain so each upload sees the running total.
      fileArray.reduce<Promise<Attachment[]>>(
        (chain, file) => chain.then((acc) => uploadFile(file, acc)),
        Promise.resolve(attachments)
      )
    },
    [uploadFile, attachments]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            // Generate a friendly name for pasted screenshots
            const ext = file.type.split('/')[1] || 'png'
            const namedFile = new File([file], `screenshot-${Date.now()}.${ext}`, { type: file.type })
            imageFiles.push(namedFile)
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        handleFiles(imageFiles)
      }
    },
    [handleFiles]
  )

  // Attach global paste listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  const handleDelete = useCallback(
    async (att: Attachment) => {
      setDeleting(att.path)
      setError(null)
      try {
        await deleteAttachment(taskId, att.path)
        const updated = attachments.filter((a) => a.path !== att.path)
        onAttachmentsChange(updated)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Delete failed'
        )
      } finally {
        setDeleting(null)
      }
    },
    [taskId, attachments, onAttachmentsChange]
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
        <Paperclip className="w-3.5 h-3.5" />
        <span className="text-xs">Attachments</span>
        {attachments.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ({attachments.length})
          </span>
        )}
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 py-5 px-4',
          'rounded-xl border border-dashed cursor-pointer',
          'transition-all duration-150',
          dragOver
            ? 'border-indigo-400/50 bg-indigo-500/10'
            : '',
          uploading && 'pointer-events-none opacity-60'
        )}
        style={dragOver ? undefined : { borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{uploadProgress}</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Drop files, click to browse, or paste a screenshot
            </span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}

      {/* Attachment list */}
      {attachments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((att) => {
            const isDeleting = deleting === att.path
            const url = signedUrls[att.name]

            return (
              <li
                key={att.path}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-lg',
                  '',
                  '',
                  'transition-colors duration-150',
                  isDeleting && 'opacity-40 pointer-events-none'
                )}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {getFileIcon(att.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                    {att.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatFileSize(att.size)}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(att)}
                    disabled={isDeleting}
                    className="p-1.5 rounded-lg hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    title="Remove attachment"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
