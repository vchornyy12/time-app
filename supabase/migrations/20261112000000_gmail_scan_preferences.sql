-- User-owned scan preferences. Automatic scans require a deployed scheduler.
BEGIN;

ALTER TABLE public.gmail_integrations
  ADD COLUMN scan_frequency text NOT NULL DEFAULT 'manual'
    CHECK (scan_frequency IN ('manual', 'daily', 'twice_daily')),
  ADD COLUMN scan_time time NOT NULL DEFAULT '08:00',
  ADD COLUMN scan_timezone text NOT NULL DEFAULT 'UTC'
    CHECK (length(scan_timezone) BETWEEN 1 AND 64),
  ADD COLUMN scan_batch_size integer NOT NULL DEFAULT 50
    CHECK (scan_batch_size IN (25, 50, 100, 500)),
  ADD COLUMN auto_scan_consent boolean NOT NULL DEFAULT false;

GRANT SELECT (scan_frequency, scan_time, scan_timezone, scan_batch_size, auto_scan_consent)
  ON public.gmail_integrations TO authenticated;
GRANT UPDATE (scan_frequency, scan_time, scan_timezone, scan_batch_size, auto_scan_consent)
  ON public.gmail_integrations TO authenticated;

COMMIT;
