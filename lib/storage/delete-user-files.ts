import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function deleteUserAttachments(admin: SupabaseClient, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid owner')
  const bucket = admin.storage.from('attachments')
  const files: string[] = []
  async function visit(prefix: string, depth: number) {
    if (depth > 10) throw new Error('Attachment folder nesting exceeds limit')
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await bucket.list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
      if (error || !data) throw new Error('Could not list account attachments')
      for (const item of data) {
        if (!item.name || item.name === '.' || item.name === '..' || (item.name.includes('/') || item.name.includes('\\') || item.name.includes('\0'))) throw new Error('Invalid attachment path')
        const path = `${prefix}/${item.name}`
        if (item.id) files.push(path)
        else await visit(path, depth + 1)
      }
      if (data.length < 100) break
    }
  }
  // Finish pagination before removing entries so offsets remain stable.
  await visit(userId, 0)
  for (let n = 0; n < files.length; n += 100) {
    const { error } = await bucket.remove(files.slice(n, n + 100))
    if (error) throw new Error('Could not remove account attachments. Please retry.')
  }
}
