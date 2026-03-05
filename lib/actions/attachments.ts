'use server'

import { revalidatePath } from 'next/cache'
import { authedClient } from '@/lib/actions/authed-action'
import {
  taskId as taskIdSchema,
  updateAttachmentsSchema,
} from '@/lib/validation/schemas'
import type { Attachment } from '@/lib/types'

// ── Get signed URLs for a task's attachments ──────────────────

export async function getAttachmentUrls(
  taskId: string
): Promise<{ name: string; url: string; type: string; size: number }[]> {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  // Fetch the task to get its attachments array
  const { data: task, error } = await supabase
    .from('tasks')
    .select('attachments')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !task) throw error ?? new Error('Task not found')

  const attachments = (task.attachments ?? []) as Attachment[]
  if (attachments.length === 0) return []

  // Generate signed URLs (valid for 1 hour)
  const results = await Promise.all(
    attachments.map(async (att) => {
      const { data } = await supabase.storage
        .from('attachments')
        .createSignedUrl(att.path, 3600)

      return {
        name: att.name,
        url: data?.signedUrl ?? '',
        type: att.type,
        size: att.size,
      }
    })
  )

  return results.filter((r) => r.url !== '')
}

// ── Update a task's attachments metadata ──────────────────────

export async function updateTaskAttachments(
  taskId: string,
  attachments: Attachment[]
) {
  const parsed = updateAttachmentsSchema.parse({ taskId, attachments })
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('tasks')
    .update({ attachments: parsed.attachments })
    .eq('id', parsed.taskId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/inbox')
}

// ── Delete a file from storage and remove from task metadata ──

export async function deleteAttachment(taskId: string, filePath: string) {
  const id = taskIdSchema.parse(taskId)
  const { supabase, user } = await authedClient()

  // Verify the file path belongs to this user
  if (!filePath.startsWith(`${user.id}/`)) {
    throw new Error('Unauthorized')
  }

  // Remove from storage
  const { error: storageError } = await supabase.storage
    .from('attachments')
    .remove([filePath])

  if (storageError) throw storageError

  // Fetch current attachments and remove the deleted one
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('attachments')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !task) throw fetchError ?? new Error('Task not found')

  const current = (task.attachments ?? []) as Attachment[]
  const updated = current.filter((att) => att.path !== filePath)

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ attachments: updated })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) throw updateError
}
