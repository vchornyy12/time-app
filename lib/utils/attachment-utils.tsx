import { FileText, Image, Film, Music, File } from 'lucide-react'

export function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image className="w-4 h-4" aria-hidden="true" />
  if (type.startsWith('video/')) return <Film className="w-4 h-4" aria-hidden="true" />
  if (type.startsWith('audio/')) return <Music className="w-4 h-4" aria-hidden="true" />
  if (type.includes('pdf') || type.includes('document') || type.includes('text'))
    return <FileText className="w-4 h-4" aria-hidden="true" />
  return <File className="w-4 h-4" aria-hidden="true" />
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
