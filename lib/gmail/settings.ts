export interface GmailSettings {
  account_email: string
  connected: boolean
  scan_frequency?: 'manual' | 'daily' | 'twice_daily'
  scan_time?: string
  scan_timezone?: string
  scan_batch_size?: 25 | 50 | 100 | 500
  auto_scan_consent?: boolean
}
