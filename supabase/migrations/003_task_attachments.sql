-- Add attachments JSONB column to tasks
-- Stores array of: { name: string, path: string, type: string, size: number }
ALTER TABLE tasks
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── Create the private "attachments" storage bucket ─────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,                    -- private bucket (requires signed URLs)
  10485760,                 -- 10 MB max file size
  NULL                      -- allow all MIME types
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS for "attachments" bucket ──────────────────────────
-- Users can only manage files under their own auth.uid() prefix.

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload their own attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read their own attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
