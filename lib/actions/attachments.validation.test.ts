/**
 * Validation contract tests for attachment server actions.
 *
 * attachments.ts uses these schemas:
 *  getAttachmentUrls   → taskId
 *  updateTaskAttachments → updateAttachmentsSchema (taskId + attachments[])
 *  deleteAttachment    → taskId + user-ownership path check
 */
import { describe, it, expect } from 'vitest'
import {
  taskId as taskIdSchema,
  updateAttachmentsSchema,
  attachmentSchema,
} from '@/lib/validation/schemas'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_ATTACHMENT = {
  name: 'report.pdf',
  path: 'user123/task456/report.pdf',
  type: 'application/pdf',
  size: 204800,
}

// ── getAttachmentUrls / deleteAttachment (taskId) ────────────

describe('getAttachmentUrls / deleteAttachment taskId validation', () => {
  it('accepts a valid UUID', () => {
    expect(taskIdSchema.parse(VALID_UUID)).toBe(VALID_UUID)
  })

  it('rejects non-UUID strings', () => {
    expect(() => taskIdSchema.parse('../etc/passwd')).toThrow('Invalid task ID')
    expect(() => taskIdSchema.parse('')).toThrow()
    expect(() => taskIdSchema.parse('1234')).toThrow()
  })

  it('rejects path-traversal attempts', () => {
    expect(() => taskIdSchema.parse('../../sensitive')).toThrow()
  })
})

// ── deleteAttachment: user-ownership path check ───────────────

describe('deleteAttachment user-ownership path guard logic', () => {
  // The action checks: filePath.startsWith(`${user.id}/`)
  // We test this guard pattern in isolation.
  const userId = 'user-abc-123'

  function isOwnedPath(filePath: string, uid: string) {
    return filePath.startsWith(`${uid}/`)
  }

  it('allows a path that starts with the user ID', () => {
    expect(isOwnedPath(`${userId}/taskId/file.pdf`, userId)).toBe(true)
  })

  it('rejects a path belonging to a different user', () => {
    expect(isOwnedPath('other-user/taskId/file.pdf', userId)).toBe(false)
  })

  it('rejects an empty path', () => {
    expect(isOwnedPath('', userId)).toBe(false)
  })

  it('rejects a path-traversal attempt', () => {
    expect(isOwnedPath('../etc/passwd', userId)).toBe(false)
  })

  it('rejects a path that almost matches but has prefix variation', () => {
    expect(isOwnedPath(`${userId}extra/task/file.pdf`, userId)).toBe(false)
  })
})

// ── updateTaskAttachments: updateAttachmentsSchema ───────────

describe('updateTaskAttachments validation (updateAttachmentsSchema)', () => {
  it('accepts a valid taskId and empty attachments', () => {
    const result = updateAttachmentsSchema.parse({ taskId: VALID_UUID, attachments: [] })
    expect(result.attachments).toHaveLength(0)
  })

  it('accepts a valid taskId with one attachment', () => {
    const result = updateAttachmentsSchema.parse({
      taskId: VALID_UUID,
      attachments: [VALID_ATTACHMENT],
    })
    expect(result.attachments[0].name).toBe('report.pdf')
  })

  it('accepts exactly 20 attachments', () => {
    const atts = Array.from({ length: 20 }, (_, i) => ({
      ...VALID_ATTACHMENT,
      name: `file${i}.pdf`,
      path: `user/${i}/file${i}.pdf`,
    }))
    const result = updateAttachmentsSchema.parse({ taskId: VALID_UUID, attachments: atts })
    expect(result.attachments).toHaveLength(20)
  })

  it('rejects more than 20 attachments', () => {
    const atts = Array.from({ length: 21 }, (_, i) => ({
      ...VALID_ATTACHMENT,
      name: `file${i}.pdf`,
      path: `user/${i}/file${i}.pdf`,
    }))
    expect(() => updateAttachmentsSchema.parse({ taskId: VALID_UUID, attachments: atts })).toThrow()
  })

  it('rejects an invalid taskId', () => {
    expect(() =>
      updateAttachmentsSchema.parse({ taskId: 'bad', attachments: [] })
    ).toThrow('Invalid task ID')
  })
})

// ── attachmentSchema edge cases ───────────────────────────────

describe('attachmentSchema edge cases', () => {
  it('accepts a zero-byte file (empty file)', () => {
    expect(attachmentSchema.parse({ ...VALID_ATTACHMENT, size: 0 })).toMatchObject({ size: 0 })
  })

  it('rejects negative size', () => {
    expect(() => attachmentSchema.parse({ ...VALID_ATTACHMENT, size: -1 })).toThrow()
  })

  it('rejects float size', () => {
    expect(() => attachmentSchema.parse({ ...VALID_ATTACHMENT, size: 1.5 })).toThrow()
  })

  it('accepts name with exactly 255 chars', () => {
    const name = 'x'.repeat(255)
    expect(attachmentSchema.parse({ ...VALID_ATTACHMENT, name }).name).toBe(name)
  })

  it('rejects name over 255 chars', () => {
    expect(() => attachmentSchema.parse({ ...VALID_ATTACHMENT, name: 'x'.repeat(256) })).toThrow()
  })

  it('accepts path with exactly 1000 chars', () => {
    const path = 'x'.repeat(1000)
    expect(attachmentSchema.parse({ ...VALID_ATTACHMENT, path }).path).toBe(path)
  })

  it('rejects path over 1000 chars', () => {
    expect(() => attachmentSchema.parse({ ...VALID_ATTACHMENT, path: 'x'.repeat(1001) })).toThrow()
  })

  it('accepts type with exactly 100 chars', () => {
    const type = 'x'.repeat(100)
    expect(attachmentSchema.parse({ ...VALID_ATTACHMENT, type }).type).toBe(type)
  })

  it('rejects type over 100 chars', () => {
    expect(() => attachmentSchema.parse({ ...VALID_ATTACHMENT, type: 'x'.repeat(101) })).toThrow()
  })

  it('accepts common MIME types', () => {
    const types = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'text/plain',
      'video/mp4',
      'audio/mpeg',
      'application/octet-stream',
    ]
    for (const type of types) {
      expect(attachmentSchema.parse({ ...VALID_ATTACHMENT, type })).toMatchObject({ type })
    }
  })
})
