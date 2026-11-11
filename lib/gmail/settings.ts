import { z } from 'zod'

export const gmailLabelSchema = z.string().trim().min(1, 'Enter a Gmail label.')
  .max(100, 'Use a label of at most 100 characters.')
  .refine(value => !/[\u0000-\u001f\u007f]/.test(value), 'Use a valid Gmail label.')

export interface GmailSettings {
  account_email: string
  connected: boolean
  scan_frequency?: 'manual' | 'daily' | 'twice_daily'
  scan_time?: string
  scan_timezone?: string
  scan_batch_size?: 25 | 50 | 100 | 500
  auto_scan_consent?: boolean
}
