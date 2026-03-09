-- Add calendar_connected to user_integrations to track whether the user
-- has granted the Google Calendar scope (independently of having a refresh token).
ALTER TABLE user_integrations
  ADD COLUMN IF NOT EXISTS calendar_connected boolean NOT NULL DEFAULT false;

-- Backfill: existing rows that already have a refresh token are considered connected.
UPDATE user_integrations
SET calendar_connected = true
WHERE google_refresh_token IS NOT NULL;
